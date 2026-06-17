/**
 * Semantic-layer tool registry (PLAN §8.2) — the typed, deterministic surface the "Ask your kitchen"
 * AGENT calls via Gemini function-calling. The model decides WHICH tools to call and WHEN; the
 * handlers here are the ONLY things that touch data, and they do so safely:
 *
 *   • Every handler is SESSION-SCOPED: it opens its own short `withTenant(getDb(), userId, …)` tx, so
 *     a tool call can never read or write another user's rows (RLS is set inside the tx).
 *   • Handlers are DETERMINISTIC — they reuse the already-tested pure analyzers / loaders; the model
 *     gets exact numbers, never predicted ones (it still runs code-execution for any math on top).
 *   • Every handler is wrapped in try/catch and returns `{ error }` on failure, so one bad tool call
 *     degrades that call rather than crashing the function-calling loop.
 *   • The ONLY mutations exposed are `add_to_list` and `save_recipe` — both ADDITIVE and REVERSIBLE.
 *     There are deliberately NO delete / order / payment / settings tools. Inputs are validated + capped.
 *
 * This module is SERVER-ONLY (it imports `@gm/db`) — reach it through a server action, never a
 * "use client" component.
 */
import {
  getDb,
  getPantryView,
  getUserBudgetCents,
  loadCookedAt,
  loadLineItemsForSpend,
  loadPreferenceSignals,
  loadPurchasesForSpend,
  loadWrappedInputs,
  saveRecipe,
  withTenant,
} from "@gm/db";
import { captureToList } from "../capture/index.js";
import {
  budgetVsActual,
  cheaperRetailer,
  spendByPeriod,
  topItemsBySpend,
  unitPriceTrends,
} from "../spend/analyze.js";
import { cooksThisWeek, currentStreak, longestStreak } from "../recipe/streak.js";
import {
  annotateRecipe,
  buildPantryIndex,
  estimateBatchFriendly,
  estimateEffort,
  rankRecipes,
  TheMealDBProvider,
} from "../recipe/index.js";
import { dietExclusions, projectUserModel } from "../personalization/index.js";
import { selectExpiringSoon } from "../pantry/index.js";
import { geminiPlanGenerator, planWeek, type PlanCandidate } from "../agent/index.js";
import type { GeminiClient } from "./client.js";

/** Per-call context — the signed-in user the tools act on behalf of. */
export interface ToolContext {
  userId: string;
  /**
   * Optional Gemini client. Only `plan_my_week` uses it (to upgrade the draft plan); when absent the
   * deterministic floor plan is used. Read tools never need it. Injected so tests can stay key-free.
   */
  client?: GeminiClient;
}

/**
 * One semantic-layer tool. `parameters` is a JSON-schema object (Gemini `functionDeclarations` shape);
 * `handler` is deterministic, session-scoped, and never throws (it catches and returns `{ error }`).
 */
export interface Tool {
  name: string;
  description: string;
  /** JSON-schema object describing the args (OpenAPI 3 subset Gemini accepts). */
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

// ---- caps (bound tokens + blast radius regardless of how chatty the model is) ----
const MAX_LIST_ITEMS = 30; // additive list-adds are capped so one call can't flood the list
const MAX_RECIPES = 6;
const MAX_TOP_ITEMS = 8;
const MAX_CHEAPER = 6;
const MAX_PRICE_TRENDS = 8;
const MAX_RECENT_TITLES = 10;
const PROVIDER_SEEDS = 4; // ingredients seeded into the recipe provider
const PROVIDER_IDS = 8; // candidate recipe ids fetched in full
const TARGET_DINNERS = 5;

const usd = (cents: number): number => Math.round(cents) / 100;
const asString = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
// Accept a real boolean OR the common stringified forms — cheaper model tiers sometimes send
// `"true"`/`"false"` (or 1/0) for boolean function args, and `v === true` would silently drop them.
const asBool = (v: unknown): boolean => v === true || v === 1 || v === "true" || v === "1";

/**
 * Build the per-user pantry index + ranked recipe candidates (mirrors the /recipes + /plan loaders).
 * Loads pantry + signals + budget in ONE tenant tx so callers (find_recipes, plan_my_week) don't open
 * a second round-trip just for the budget.
 */
async function loadRankedRecipes(
  ctx: ToolContext,
  opts: { query?: string; useExpiring?: boolean; lowEnergy?: boolean; limit: number },
) {
  const { pantry, signals, budgetCents } = await withTenant(getDb(), ctx.userId, async (tx) => ({
    pantry: await getPantryView(tx, ctx.userId),
    signals: await loadPreferenceSignals(tx, ctx.userId),
    budgetCents: await getUserBudgetCents(tx, ctx.userId),
  }));

  const inStock = pantry.filter((p) => p.status === "in_stock" || p.status === "low");
  const expiringNames = selectExpiringSoon(pantry, { domain: "grocery", withinDays: 5 }).map((e) => e.name);

  const idx = buildPantryIndex(
    inStock.map((p) => ({
      name: p.name,
      aliases: p.aliases ?? [],
      inStock: true,
      expiringSoon: p.status === "low" || p.status === "expired_likely",
    })),
  );

  // Seed the provider with the user's explicit query FIRST (so it's never sliced off the front),
  // then expiring "use it up" items when asked, then the rest of what's in stock.
  const seedNames = [
    ...(opts.query ? [opts.query] : []),
    ...(opts.useExpiring ? expiringNames : []),
    ...inStock.map((p) => p.name),
  ];
  const seeds = [...new Set(seedNames)].slice(0, PROVIDER_SEEDS);

  const provider = new TheMealDBProvider();
  const found = (await Promise.all(seeds.map((s) => provider.searchByIngredient(s).catch(() => [])))).flat();
  const ids = [...new Set(found.map((f) => f.id))].slice(0, PROVIDER_IDS);
  const full = (await Promise.all(ids.map((id) => provider.getById(id).catch(() => null)))).filter(
    (r): r is NonNullable<typeof r> => r != null,
  );

  const model = projectUserModel(signals);
  const annotated = full.map((r) => {
    const { effortScore } = estimateEffort({ ingredientCount: r.ingredients.length, instructions: r.instructions });
    const { batchScore } = estimateBatchFriendly({ title: r.title, instructions: r.instructions, cuisine: r.cuisine });
    return annotateRecipe(
      { id: r.id, title: r.title, ingredients: r.ingredients, effortScore, batchScore, cuisine: r.cuisine },
      idx,
    );
  });
  const ranked = rankRecipes(annotated, {
    limit: opts.limit,
    lowEnergy: opts.lowEnergy,
    prefs: {
      allergens: [...model.allergens, ...dietExclusions(model.diets)],
      dislikes: model.dislikes,
      loves: model.loves,
      cuisineAffinity: model.cuisineAffinity,
    },
  });

  return {
    ranked,
    annotated,
    model,
    expiringNames,
    budgetCents,
    images: new Map(full.map((r) => [r.id, r.imageUrl ?? ""])),
  };
}

/**
 * Build the per-user tool set. Each tool's handler is deterministic + session-scoped (its own tenant
 * tx) and catches its own errors. `buildSemanticTools` does no I/O — it binds `ctx` as the handlers'
 * DEFAULT context (`c = ctx`); the function-calling loop also passes a `ctx` at call time, which wins,
 * so the same user is scoped either way.
 */
export function buildSemanticTools(ctx: ToolContext): Tool[] {
  return [
    {
      name: "get_pantry",
      description:
        "List the user's current pantry items with status (in_stock / low / expired_likely / unknown) " +
        "and estimated run-out date. Use to answer 'what do I have' and to ground recipe/shopping advice.",
      parameters: { type: "object", properties: {} },
      handler: async (_args, c = ctx) => {
        try {
          const rows = await withTenant(getDb(), c.userId, (tx) => getPantryView(tx, c.userId));
          return {
            count: rows.length,
            items: rows.map((p) => ({
              name: p.name,
              status: p.status,
              runOutAt: p.estimatedRunOutAt ? new Date(p.estimatedRunOutAt).toISOString().slice(0, 10) : null,
            })),
          };
        } catch (e) {
          return { error: errMsg(e) };
        }
      },
    },

    {
      name: "analyze_spend",
      description:
        "Exact grocery spending facts: spend grouped by week and month, top items by spend, unit-price " +
        "trends, cheaper-retailer opportunities, and this-week budget vs actual. All amounts are integer " +
        "cents AND dollars. Use this for any spending question; run code-execution for any further math.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["week", "month"],
            description: "Which bucketing to emphasize in the summary. Defaults to month.",
          },
        },
      },
      handler: async (args, c = ctx) => {
        try {
          const period = asString(args.period) === "week" ? "week" : "month";
          const { purchases, lineItems, budgetCents } = await withTenant(getDb(), c.userId, async (tx) => ({
            purchases: await loadPurchasesForSpend(tx, c.userId),
            lineItems: await loadLineItemsForSpend(tx, c.userId),
            budgetCents: await getUserBudgetCents(tx, c.userId),
          }));

          const byWeek = spendByPeriod(purchases, "week");
          const byMonth = spendByPeriod(purchases, "month");
          const now = new Date();
          const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
          dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
          const thisWeekCents = byWeek.find((p) => p.periodStart === dt.toISOString().slice(0, 10))?.totalCents ?? 0;
          const budget = budgetVsActual(thisWeekCents, budgetCents);

          return {
            emphasis: period,
            byWeek: byWeek.slice(0, 8).map((p) => ({ periodStart: p.periodStart, cents: p.totalCents, usd: usd(p.totalCents) })),
            byMonth: byMonth.slice(0, 6).map((p) => ({ periodStart: p.periodStart, cents: p.totalCents, usd: usd(p.totalCents) })),
            topItems: topItemsBySpend(lineItems, MAX_TOP_ITEMS).map((i) => ({ name: i.name, cents: i.totalCents, usd: usd(i.totalCents) })),
            priceTrends: unitPriceTrends(lineItems)
              .sort((a, b) => b.maxCents - b.minCents - (a.maxCents - a.minCents))
              .slice(0, MAX_PRICE_TRENDS)
              .map((t) => ({ name: t.name, latestCents: t.latestCents, minCents: t.minCents, maxCents: t.maxCents, avgCents: t.avgCents })),
            cheaperElsewhere: cheaperRetailer(lineItems)
              .slice(0, MAX_CHEAPER)
              .map((c2) => ({ name: c2.name, bestRetailer: c2.bestRetailer, bestCents: c2.bestCents, savingsVsWorstCents: c2.savingsVsWorstCents })),
            budget: {
              thisWeekActualCents: budget.actualCents,
              thisWeekActualUsd: usd(budget.actualCents),
              weeklyBudgetCents: budget.budgetCents,
              weeklyBudgetUsd: budget.budgetCents == null ? null : usd(budget.budgetCents),
              deltaCents: budget.deltaCents,
              overBudget: budget.overBudget,
            },
          };
        } catch (e) {
          return { error: errMsg(e) };
        }
      },
    },

    {
      name: "get_cooking_stats",
      description:
        "The user's cooking momentum: current streak (days), longest streak, cooks this week, total " +
        "tracked cooks, and recent recipe titles. Use for motivation / habit questions.",
      parameters: { type: "object", properties: {} },
      handler: async (_args, c = ctx) => {
        try {
          const { cookedAt, wrapped } = await withTenant(getDb(), c.userId, async (tx) => ({
            cookedAt: await loadCookedAt(tx, c.userId),
            wrapped: await loadWrappedInputs(tx, c.userId, 120),
          }));
          const now = new Date();
          const recentRecipes = [...wrapped.mealLogs]
            .sort((a, b) => b.cookedAt.getTime() - a.cookedAt.getTime())
            .map((m) => m.recipeTitle)
            .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
            .slice(0, MAX_RECENT_TITLES);
          return {
            currentStreakDays: currentStreak(cookedAt, now),
            longestStreakDays: longestStreak(cookedAt),
            cooksThisWeek: cooksThisWeek(cookedAt, now),
            totalCooksTracked: cookedAt.length,
            recentRecipes,
          };
        } catch (e) {
          return { error: errMsg(e) };
        }
      },
    },

    {
      name: "get_taste_profile",
      description:
        "The user's LEARNED taste model (from their behavior, not a form): diets, allergens, loved and " +
        "disliked ingredients, and top cuisines by affinity. Use to personalize any recommendation.",
      parameters: { type: "object", properties: {} },
      handler: async (_args, c = ctx) => {
        try {
          const signals = await withTenant(getDb(), c.userId, (tx) => loadPreferenceSignals(tx, c.userId));
          const model = projectUserModel(signals);
          return {
            diets: model.diets,
            allergens: model.allergens,
            loves: model.loves,
            dislikes: model.dislikes,
            topCuisines: Object.entries(model.cuisineAffinity)
              .map(([cuisine, affinity]) => ({ cuisine, affinity }))
              .sort((a, b) => b.affinity - a.affinity)
              .slice(0, 8),
          };
        } catch (e) {
          return { error: errMsg(e) };
        }
      },
    },

    {
      name: "find_recipes",
      description:
        "Suggest recipes the user can cook, ranked by what they already have. Returns each recipe's id, " +
        "title, coverage, the ingredients they HAVE vs are MISSING, and how many expiring items it uses. " +
        "Pass useExpiring:true to favor using up expiring food, or a query to bias toward an ingredient/dish.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional ingredient or dish to bias the search (e.g. 'chicken')." },
          useExpiring: { type: "boolean", description: "Prefer recipes that use up items expiring soon." },
        },
      },
      handler: async (args, c = ctx) => {
        try {
          const { ranked, expiringNames } = await loadRankedRecipes(c, {
            query: asString(args.query),
            useExpiring: asBool(args.useExpiring),
            limit: MAX_RECIPES,
          });
          return {
            expiringSoon: expiringNames.slice(0, 12),
            recipes: ranked.map((r) => ({
              id: r.id,
              title: r.title,
              coveragePct: Math.round(r.coverage * 100),
              have: r.haveCount,
              totalCore: r.totalCore,
              missing: r.missing,
              usesExpiring: r.usesExpiring,
              batchFriendly: r.batchFriendly,
            })),
          };
        } catch (e) {
          return { error: errMsg(e) };
        }
      },
    },

    {
      name: "add_to_list",
      description:
        "ADD items to the user's shopping list (additive and reversible — it never removes anything). " +
        "Only call this when the user asks to add something or clearly wants it. Confirm what you added.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "string" },
            description: "Item names to add to the shopping list.",
          },
        },
        required: ["items"],
      },
      handler: async (args, c = ctx) => {
        try {
          const raw = Array.isArray(args.items) ? args.items : [];
          const seen = new Set<string>();
          const names = raw
            .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
            .map((n) => n.trim())
            // Drop case-insensitive dupes within this one call so we don't insert "milk"/"Milk" twice.
            .filter((n) => {
              const key = n.toLowerCase();
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .slice(0, MAX_LIST_ITEMS);
          if (names.length === 0) return { error: "no valid item names provided" };
          const res = await withTenant(getDb(), c.userId, (tx) =>
            captureToList(tx, c.userId, names.map((name) => ({ name })), { reason: "recipe_need" }),
          );
          return { added: res.added, requested: names.length, items: names };
        } catch (e) {
          return { error: errMsg(e) };
        }
      },
    },

    {
      name: "save_recipe",
      description:
        "SAVE a recipe to the user's cookbook (additive and reversible). Pass the recipe's id and title " +
        "(use ids returned by find_recipes). Only call when the user wants to save it; confirm afterward.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The recipe id (from find_recipes)." },
          title: { type: "string", description: "The recipe title." },
          imageUrl: { type: "string", description: "Optional cover image URL." },
          cuisine: { type: "string", description: "Optional cuisine." },
        },
        required: ["id", "title"],
      },
      handler: async (args, c = ctx) => {
        try {
          const id = asString(args.id)?.trim();
          const title = asString(args.title)?.trim();
          if (!id || !title) return { error: "save_recipe requires both id and title" };
          await withTenant(getDb(), c.userId, (tx) =>
            saveRecipe(tx, c.userId, { id, title, imageUrl: asString(args.imageUrl), cuisine: asString(args.cuisine) }),
          );
          return { saved: true, id, title };
        } catch (e) {
          return { error: errMsg(e) };
        }
      },
    },

    {
      name: "plan_my_week",
      description:
        "Draft a weekly dinner plan from what the user has, using up expiring food first. Returns the " +
        "chosen dinners (day, title, reason) and the shopping gap (items to buy). This is a DRAFT only — " +
        "it does NOT place an order or modify the list. Use add_to_list afterward only if the user asks.",
      parameters: {
        type: "object",
        properties: {
          lowEnergy: { type: "boolean", description: "Favor quick, low-cleanup dinners for a busy week." },
        },
      },
      handler: async (args, c = ctx) => {
        try {
          const lowEnergy = asBool(args.lowEnergy);
          const { ranked, annotated, model, expiringNames, budgetCents } = await loadRankedRecipes(c, {
            lowEnergy,
            limit: 8,
          });
          const annotatedById = new Map(annotated.map((a) => [a.id, a]));
          const candidates: PlanCandidate[] = ranked.map((r) => ({
            id: r.id,
            title: r.title,
            coverage: r.coverage,
            missing: r.missing,
            usesExpiring: r.usesExpiring,
            expiringIngredients: (annotatedById.get(r.id)?.ingredients ?? [])
              .filter((i) => i.inPantry && i.expiringSoon)
              .map((i) => i.name),
            cuisine: annotatedById.get(r.id)?.cuisine,
          }));

          // Upgrade with the LLM planner when a client is available; otherwise the deterministic floor runs.
          const generate = c.client ? geminiPlanGenerator(c.client) : undefined;
          const result = await planWeek(
            {
              candidates,
              expiringNames,
              prefs: { diets: model.diets, allergens: model.allergens, dislikes: model.dislikes },
              budgetCents,
              targetDinners: TARGET_DINNERS,
              lowEnergy,
            },
            { generate },
          );

          return {
            draft: true,
            source: result.source,
            narrative: result.plan.narrative,
            dinners: result.plan.dinners.map((d) => ({ day: d.day, title: d.title, reason: d.reason, recipeId: d.recipeId })),
            shoppingGap: result.plan.addToList,
          };
        } catch (e) {
          return { error: errMsg(e) };
        }
      },
    },
  ];
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
