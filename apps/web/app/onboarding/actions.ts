"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import {
  appendPreferenceSignal,
  getDb,
  loadPreferenceSignals,
  persistUserModel,
  withTenant,
} from "@gm/db";
import { nextOnboardingTurn, projectUserModel } from "@gm/core/personalization";
import { getGeminiClient } from "@gm/core/llm";
import { currentUserId } from "@/app/lib/tenant";

/** The chat message shape exchanged with the client (matches `nextOnboardingTurn`'s input). */
export type OnboardingMessage = { role: "user" | "assistant"; content: string };

// Bound what we forward to the model — onboarding is short, but a client could send a long thread.
const MAX_MESSAGES = 16;

/**
 * One adaptive onboarding turn (AI path). Runs the host model on the conversation so far, then
 * persists the preferences it extracted from the user's latest answer into the SAME ledger the
 * keyless wizard writes (source "onboarding_q") — so the UserModel moves identically either way.
 * Re-projection into the materialized model happens once at the end (`finishOnboardingAction`).
 *
 * Never throws to the client: any failure (no session, Gemini hiccup) degrades to a friendly reply
 * with `done:false`, so the chat keeps going rather than breaking the flow.
 */
export async function onboardingTurnAction(
  messages: OnboardingMessage[],
): Promise<{ reply: string; done: boolean }> {
  try {
    const userId = await currentUserId();
    if (!userId) {
      return { reply: "Please sign in so I can save what I learn about your taste.", done: false };
    }

    // Sanitize + cap the incoming conversation before doing any work.
    const trimmed = (messages ?? [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m): OnboardingMessage => ({ role: m.role, content: m.content.slice(0, 2000) }))
      .slice(-MAX_MESSAGES);

    const turn = await nextOnboardingTurn(getGeminiClient(), trimmed);

    // Persist the extracted signals (already validated to the allowed UserModel topics by the core).
    if (turn.signals.length > 0) {
      await withTenant(getDb(), userId, async (tx) => {
        for (const s of turn.signals) {
          await appendPreferenceSignal(tx, {
            userId,
            topic: s.topic,
            value: s.value ?? null,
            polarity: s.polarity,
            source: "onboarding_q",
            confidence: s.confidence,
          });
        }
      });
    }

    return { reply: turn.reply, done: turn.done };
  } catch {
    // Graceful fallback — keep the conversation alive instead of surfacing an error.
    return {
      reply: "Got it! Tell me a bit more — what kinds of food do you usually love to eat?",
      done: false,
    };
  }
}

/**
 * Finish onboarding: re-project the full ledger into the materialized UserModel (so the planner +
 * ranking read the freshest picture), then redirect to the home page. Mirrors the wizard's
 * `saveOnboarding` tail. `redirect` throws NEXT_REDIRECT, which must propagate — `unstable_rethrow`
 * lets it through any surrounding try/catch (here it's outside the tenant tx, so it's already clear,
 * but we keep the guard for parity with the established pattern).
 */
export async function finishOnboardingAction(): Promise<void> {
  try {
    const userId = await currentUserId();
    if (userId) {
      await withTenant(getDb(), userId, async (tx) => {
        const model = projectUserModel(await loadPreferenceSignals(tx, userId));
        await persistUserModel(tx, userId, {
          diets: model.diets,
          allergens: model.allergens,
          cuisineAffinity: model.cuisineAffinity,
          qualityPrefs: model.qualityPrefs,
          confidencePerField: model.confidencePerField,
        });
      });
    }
  } catch (e) {
    unstable_rethrow(e); // let NEXT_REDIRECT (if any) through; otherwise swallow so finish never blocks
  }
  redirect("/");
}
