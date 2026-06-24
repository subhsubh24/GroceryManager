"use server";

import {
  getDb,
  getPantryView,
  getUserBudgetCents,
  loadCookedAt,
  loadLineItemsForSpend,
  loadPreferenceSignals,
  loadPurchasesForSpend,
  loadWrappedInputs,
  withTenant,
} from "@gm/db";
import { loadEnv } from "@gm/config/env";
import { getGeminiClient } from "@gm/core/llm";
import { answerKitchenChat, buildKitchenBrief, type ChatMessage } from "@gm/core/chat";
import { currentUserId } from "@/app/lib/tenant";

// Bound the conversation we forward to the model (keeps tokens in check on long threads).
const MAX_MESSAGES = 12;

/**
 * "Ask your kitchen" — answer a chat for the signed-in user via the SEMANTIC-LAYER agent. With a
 * Gemini key the agent runs a function-calling loop: it fetches the user's own pantry/spend/cooking/
 * taste/recipes through scoped tools (and can take additive actions — add to list, save a recipe,
 * draft a plan), computing every number with code-execution. Without a key it degrades to a
 * deterministic, pre-computed summary built from the bounded brief (loaded in ONE tenant transaction).
 * Session-scoped (no session → a friendly sign-in nudge) and wrapped in try/catch so it always returns
 * a reply, never throws to the client. The only writes possible are the additive, reversible tool
 * actions; the keyless path mutates nothing.
 */
export async function askAction(messages: ChatMessage[]): Promise<{ reply: string }> {
  try {
    const userId = await currentUserId();
    if (!userId) {
      return { reply: "Please sign in so I can look at your kitchen and answer your questions." };
    }

    // Sanitize + cap the incoming conversation before doing any work.
    const trimmed = (messages ?? [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m): ChatMessage => ({ role: m.role, content: m.content.slice(0, 2000) }))
      .slice(-MAX_MESSAGES);
    if (trimmed.length === 0) {
      return { reply: "Ask me anything about your spending, pantry, or cooking habits." };
    }

    const env = loadEnv();
    const client = (env.GEMINI_API_KEY || env.GOOGLE_VERTEX_PROJECT) ? getGeminiClient() : undefined;

    // Build the bounded brief in one RLS round-trip. The agent fetches its own data through scoped
    // tools, but the brief is still the deterministic fallback for BOTH the keyless path AND any
    // agent failure / blank reply — so it must hold real data, not a placeholder, or a transient
    // Gemini outage would tell a data-rich user "I don't have much data on your kitchen yet".
    const brief = await buildBriefForFallback(userId);

    return await answerKitchenChat({ client, userId }, { messages: trimmed, brief });
  } catch {
    return { reply: "Something went wrong loading your kitchen. Please try again in a moment." };
  }
}

/** Load + assemble the bounded brief used by the deterministic summary fallback (one tenant tx). */
async function buildBriefForFallback(userId: string) {
  const data = await withTenant(getDb(), userId, async (tx) => ({
    pantry: await getPantryView(tx, userId),
    purchases: await loadPurchasesForSpend(tx, userId),
    lineItems: await loadLineItemsForSpend(tx, userId),
    cookedAt: await loadCookedAt(tx, userId),
    // Match loadCookedAt's default 120-day window so recent recipe titles cover the same horizon
    // the streak/total stats describe (avoids the brief claiming cooks it lists no titles for).
    wrapped: await loadWrappedInputs(tx, userId, 120),
    signals: await loadPreferenceSignals(tx, userId),
    budgetCents: await getUserBudgetCents(tx, userId),
  }));

  const recentCookedTitles = [...data.wrapped.mealLogs]
    .sort((a, b) => b.cookedAt.getTime() - a.cookedAt.getTime())
    .map((m) => m.recipeTitle)
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0);

  return buildKitchenBrief({
    pantry: data.pantry.map((p) => ({ name: p.name, status: p.status, estimatedRunOutAt: p.estimatedRunOutAt })),
    purchases: data.purchases,
    lineItems: data.lineItems,
    cookedAt: data.cookedAt,
    recentCookedTitles,
    signals: data.signals,
    weeklyBudgetCents: data.budgetCents,
  });
}
