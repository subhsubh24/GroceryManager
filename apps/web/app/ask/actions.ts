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
import { getGeminiClient } from "@gm/core/llm";
import { answerKitchenChat, buildKitchenBrief, type ChatMessage } from "@gm/core/chat";
import { currentUserId } from "@/app/lib/tenant";

// Bound the conversation we forward to the model (keeps tokens in check on long threads).
const MAX_MESSAGES = 12;

/**
 * "Ask your kitchen" — answer a chat grounded ONLY in the signed-in user's own data. READ-ONLY: it
 * loads pantry/spend/cooking/taste in ONE tenant transaction, builds the bounded brief (pre-computing
 * every deterministic fact via the pure analyzers + projectUserModel), then hands it to
 * answerKitchenChat. A Gemini key enables full chat with code-execution math; without one it degrades
 * to a pre-computed summary. Session-scoped (no session → a friendly sign-in nudge) and wrapped in
 * try/catch so it always returns a reply, never throws to the client. Mutates nothing.
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

    // One RLS round-trip for every read the brief needs.
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

    const brief = buildKitchenBrief({
      pantry: data.pantry.map((p) => ({
        name: p.name,
        status: p.status,
        estimatedRunOutAt: p.estimatedRunOutAt,
      })),
      purchases: data.purchases,
      lineItems: data.lineItems,
      cookedAt: data.cookedAt,
      recentCookedTitles,
      signals: data.signals,
      weeklyBudgetCents: data.budgetCents,
    });

    const client = process.env.GEMINI_API_KEY ? getGeminiClient() : undefined;
    return await answerKitchenChat({ client }, { messages: trimmed, brief });
  } catch {
    return { reply: "Something went wrong loading your kitchen. Please try again in a moment." };
  }
}
