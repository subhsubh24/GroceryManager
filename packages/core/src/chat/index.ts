/**
 * "Ask your kitchen" — a conversational assistant grounded ONLY in the signed-in user's own data
 * (pantry, spending, cooking history, and the learned taste model). It answers questions about
 * habits, gives recommendations, and surfaces insights. READ-ONLY/advisory: nothing here mutates.
 *
 * Two pieces, split so the deterministic half is pure + unit-testable:
 *   • buildKitchenBrief — a PURE assembler that turns loaded rows + the pure analyzers into a
 *     compact, BOUNDED snapshot (the "brief"). Caps every list so token cost stays controlled.
 *   • answerKitchenChat — calls Gemini MULTI-TURN with the code-execution tool ON, so EVERY number
 *     (totals, averages, trends, projections) is computed by running Python, never predicted. With
 *     no client (no GEMINI_API_KEY) it degrades to a short reply built from the pre-computed stats,
 *     and any LLM failure falls back to that same summary — it never throws to the caller.
 *
 * This imports the server-only llm client, so it must be reached via a server action — never from a
 * "use client" component. (The web `askAction` is the intended entry point.)
 */
import type { ChatTurn, GeminiClient } from "../llm/client.js";
import {
  budgetVsActual,
  cheaperRetailer,
  spendByPeriod,
  topItemsBySpend,
  unitPriceTrends,
  type CheaperRetailer,
  type ItemSpend,
  type SpendPeriod,
  type UnitPriceTrend,
} from "../spend/analyze.js";
import { cooksThisWeek, currentStreak, longestStreak } from "../recipe/streak.js";
import { projectUserModel, type PreferenceSignalInput } from "../personalization/user-model.js";

/** One conversation turn (the public shape the web passes in). */
export type ChatMessage = { role: "user" | "assistant"; content: string };

// Caps — keep the brief bounded so the prompt stays cheap regardless of how much history a user has.
const MAX_PANTRY = 50;
const MAX_TOP_ITEMS = 12;
const MAX_PRICE_TRENDS = 12;
const MAX_CHEAPER = 8;
const MAX_RECENT_PURCHASES = 50;
const MAX_RECENT_LINES = 50;
const MAX_RECENT_COOKS = 20;

/** Raw inputs (already RLS-scoped + loaded) the brief is assembled from. */
export interface KitchenBriefInputs {
  now?: Date;
  pantry: {
    name: string;
    status: string;
    estimatedRunOutAt?: Date | null;
  }[];
  purchases: { purchasedAt: Date; totalCents: number | null }[];
  lineItems: {
    canonicalItemId: string;
    name: string;
    retailer: string;
    purchasedAt: Date;
    unitPriceCents: number | null;
    lineTotalCents: number | null;
  }[];
  cookedAt: Date[];
  recentCookedTitles?: string[];
  signals: PreferenceSignalInput[];
  weeklyBudgetCents?: number | null;
}

/** A compact, BOUNDED structured snapshot of the user's kitchen — the chat's only ground truth. */
export interface KitchenBrief {
  generatedAt: string;
  pantry: { name: string; status: string; runOutAt: string | null }[];
  spend: {
    byMonth: SpendPeriod[];
    byWeek: SpendPeriod[];
    topItems: ItemSpend[];
    priceTrends: UnitPriceTrend[];
    cheaperElsewhere: CheaperRetailer[];
    budget: {
      thisWeekActualCents: number;
      weeklyBudgetCents: number | null;
      deltaCents: number | null;
      overBudget: boolean;
    };
  };
  cooking: {
    currentStreakDays: number;
    longestStreakDays: number;
    cooksThisWeek: number;
    totalCooksTracked: number;
    recentRecipes: string[];
  };
  taste: {
    diets: string[];
    allergens: string[];
    loves: string[];
    dislikes: string[];
    topCuisines: { cuisine: string; affinity: number }[];
  };
  /** A bounded slice of raw rows so the model can do ad-hoc code-execution analysis. */
  recent: {
    purchases: { date: string; totalCents: number }[];
    lineItems: { name: string; unitPriceCents: number; retailer: string; date: string }[];
  };
}

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** Cooks in the current Monday-start UTC week — the budget window matches spend's weekly buckets. */
function thisWeekSpendCents(byWeek: SpendPeriod[], now: Date): number {
  // spendByPeriod groups by the UTC Monday; recompute the same key for `now` and look it up.
  const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const mondayOffset = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - mondayOffset);
  const key = dt.toISOString().slice(0, 10);
  return byWeek.find((p) => p.periodStart === key)?.totalCents ?? 0;
}

/**
 * PURE assembler — loaded rows + the (already-tested) analyzers → a bounded brief. Null-safe and
 * empty-user-safe: every field has a sensible default, and every list is capped. No I/O, no LLM.
 */
export function buildKitchenBrief(inputs: KitchenBriefInputs): KitchenBrief {
  const now = inputs.now ?? new Date();

  const pantry = inputs.pantry.slice(0, MAX_PANTRY).map((p) => ({
    name: p.name,
    status: p.status,
    runOutAt: p.estimatedRunOutAt ? isoDay(p.estimatedRunOutAt) : null,
  }));

  const byMonth = spendByPeriod(inputs.purchases, "month");
  const byWeek = spendByPeriod(inputs.purchases, "week");
  const topItems = topItemsBySpend(inputs.lineItems, MAX_TOP_ITEMS);
  const priceTrends = unitPriceTrends(inputs.lineItems)
    // Surface the items with the most price movement first (most useful for "what's gotten pricier").
    .sort((a, b) => b.maxCents - b.minCents - (a.maxCents - a.minCents))
    .slice(0, MAX_PRICE_TRENDS);
  const cheaperElsewhere = cheaperRetailer(inputs.lineItems).slice(0, MAX_CHEAPER);

  const thisWeekActualCents = thisWeekSpendCents(byWeek, now);
  const budgetStatus = budgetVsActual(thisWeekActualCents, inputs.weeklyBudgetCents);

  const model = projectUserModel(inputs.signals);
  const topCuisines = Object.entries(model.cuisineAffinity)
    .map(([cuisine, affinity]) => ({ cuisine, affinity }))
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, 8);

  const recentPurchases = [...inputs.purchases]
    .sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime())
    .slice(0, MAX_RECENT_PURCHASES)
    .map((p) => ({ date: isoDay(p.purchasedAt), totalCents: p.totalCents ?? 0 }));

  const recentLines = [...inputs.lineItems]
    .sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime())
    .filter((l) => l.unitPriceCents != null)
    .slice(0, MAX_RECENT_LINES)
    .map((l) => ({
      name: l.name,
      unitPriceCents: l.unitPriceCents as number,
      retailer: l.retailer,
      date: isoDay(l.purchasedAt),
    }));

  return {
    generatedAt: now.toISOString(),
    pantry,
    spend: {
      byMonth,
      byWeek,
      topItems,
      priceTrends,
      cheaperElsewhere,
      budget: {
        thisWeekActualCents,
        weeklyBudgetCents: budgetStatus.budgetCents,
        deltaCents: budgetStatus.deltaCents,
        overBudget: budgetStatus.overBudget,
      },
    },
    cooking: {
      currentStreakDays: currentStreak(inputs.cookedAt, now),
      longestStreakDays: longestStreak(inputs.cookedAt),
      cooksThisWeek: cooksThisWeek(inputs.cookedAt, now),
      totalCooksTracked: inputs.cookedAt.length,
      recentRecipes: (inputs.recentCookedTitles ?? [])
        .filter((t) => typeof t === "string" && t.trim().length > 0)
        .slice(0, MAX_RECENT_COOKS),
    },
    taste: {
      diets: model.diets,
      allergens: model.allergens,
      loves: model.loves,
      dislikes: model.dislikes,
      topCuisines,
    },
    recent: { purchases: recentPurchases, lineItems: recentLines },
  };
}

const SYSTEM =
  "You are a warm, sharp grocery + cooking coach for ONE user. Answer ONLY from the provided JSON " +
  "data about THIS user (their pantry, spending, cooking history, and learned taste). For ANY math, " +
  "totals, averages, trends, comparisons, or projections, you MUST use the code execution tool and " +
  "base your numbers on the provided data — never estimate numbers yourself. Money values are integer " +
  "cents; convert to dollars for the user. Be concise, specific, and actionable; ground every " +
  "recommendation in their actual habits and taste. If the data can't answer the question, say so " +
  "plainly rather than guessing. You cannot change any of their data — you only advise.";

const fmtUsd = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

/**
 * Deterministic, key-free reply built ONLY from the brief's PRE-COMPUTED stats (no LLM). Used both as
 * the no-key fallback and the catch-all when an LLM call fails — so the feature degrades, never throws.
 */
export function summarizeBrief(brief: KitchenBrief, keyless: boolean): string {
  const lines: string[] = [];
  const b = brief.spend;

  if (b.byMonth[0]) lines.push(`This month you've spent ${fmtUsd(b.byMonth[0].totalCents)} on groceries.`);
  if (b.budget.weeklyBudgetCents != null && b.budget.deltaCents != null) {
    lines.push(
      b.budget.overBudget
        ? `This week you're ${fmtUsd(b.budget.deltaCents)} over your ${fmtUsd(b.budget.weeklyBudgetCents)} budget.`
        : `This week you're ${fmtUsd(-b.budget.deltaCents)} under your ${fmtUsd(b.budget.weeklyBudgetCents)} budget.`,
    );
  }
  if (b.topItems[0]) lines.push(`Your top spend item is ${b.topItems[0].name} (${fmtUsd(b.topItems[0].totalCents)}).`);
  if (b.cheaperElsewhere[0]) {
    const c = b.cheaperElsewhere[0];
    lines.push(`You could save on ${c.name} — it's cheapest at ${c.bestRetailer}.`);
  }

  const ck = brief.cooking;
  if (ck.currentStreakDays > 0) lines.push(`You're on a ${ck.currentStreakDays}-day cooking streak — keep it up!`);
  if (ck.totalCooksTracked > 0) {
    lines.push(`You've cooked ${ck.cooksThisWeek} time${ck.cooksThisWeek === 1 ? "" : "s"} this week.`);
  }

  if (brief.taste.diets.length) lines.push(`Noted diets: ${brief.taste.diets.join(", ")}.`);
  if (brief.taste.topCuisines[0]) lines.push(`Your top cuisine is ${brief.taste.topCuisines[0].cuisine}.`);

  if (lines.length === 0) {
    lines.push("I don't have much data on your kitchen yet — add some receipts, pantry items, or log a cooked meal.");
  }

  if (keyless) {
    lines.push("\nFor full conversational answers (with on-the-fly analysis), add a GEMINI_API_KEY.");
  }
  return lines.join(" ").replace(" \n", "\n");
}

export interface AnswerDeps {
  client?: GeminiClient;
}

export interface AnswerArgs {
  messages: ChatMessage[];
  brief: KitchenBrief;
}

/**
 * Answer the user's chat, grounded in the brief. With no client → key-free summary. With a client →
 * a multi-turn Gemini call with code execution ENABLED (so every number is computed in Python). The
 * brief is injected as JSON in front of the conversation. Any failure falls back to the summary —
 * this never throws to the caller.
 */
export async function answerKitchenChat(deps: AnswerDeps, args: AnswerArgs): Promise<{ reply: string }> {
  if (!deps.client) {
    return { reply: summarizeBrief(args.brief, true) };
  }
  try {
    // Lead with the data as a user turn, then the conversation. The system instruction forbids
    // doing math in-head and requires the code-execution tool for any numbers.
    const dataTurn: ChatTurn = {
      role: "user",
      content:
        "Here is the JSON data about my kitchen. Use ONLY this to answer my questions, and run Python " +
        `for any math:\n\n${JSON.stringify(args.brief)}`,
    };
    const turns: ChatTurn[] = [
      dataTurn,
      { role: "assistant", content: "Got it — I've loaded your kitchen data. What would you like to know?" },
      ...args.messages.map((m): ChatTurn => ({ role: m.role, content: m.content })),
    ];

    const { text } = await deps.client.chat({
      messages: turns,
      system: SYSTEM,
      codeExecution: true,
      tier: "cheap",
    });
    const reply = text.trim();
    return { reply: reply.length > 0 ? reply : summarizeBrief(args.brief, false) };
  } catch {
    // Never throw to the caller — degrade to the deterministic, pre-computed summary.
    return { reply: summarizeBrief(args.brief, false) };
  }
}
