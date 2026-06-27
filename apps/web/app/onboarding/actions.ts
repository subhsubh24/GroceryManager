"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import {
  appendPreferenceSignal,
  getDb,
  loadPreferenceSignals,
  persistUserModel,
  withTenant,
} from "@gm/db";
import {
  answersToSignals,
  nextOnboardingTurn,
  projectUserModel,
  signalFromProfileAge,
  signalFromProfileGender,
  signalFromProfileName,
  type OnboardingAnswers,
} from "@gm/core/personalization";
import { getGeminiClient } from "@gm/core/llm";
import { isPremium } from "@gm/core/billing";
import { currentUserId } from "@/app/lib/tenant";
import { checkLlmQuota } from "@/app/api/_lib/llm-quota";

/** The chat message shape exchanged with the client (matches `nextOnboardingTurn`'s input). */
export type OnboardingMessage = { role: "user" | "assistant"; content: string };

/** The profile step's payload (name/age/gender → profile:* preference signals). */
export type ProfileInput = { name?: string; age?: string; gender?: string };

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
): Promise<{ reply: string; done: boolean; options: string[] }> {
  const userId = await currentUserId();
  if (!userId) {
    return {
      reply: "Please sign in so I can save what I learn about your taste.",
      done: false,
      options: [],
    };
  }

  // Sanitize + cap the incoming conversation before doing any work.
  const trimmed = (messages ?? [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m): OnboardingMessage => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-MAX_MESSAGES);

  const signals = await withTenant(getDb(), userId, (tx) => loadPreferenceSignals(tx, userId));
  const quota = checkLlmQuota(userId, isPremium(signals));
  if (!quota.allowed) {
    return { reply: "Daily AI limit reached — upgrade for more.", done: false, options: [] };
  }

  try {
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

    return { reply: turn.reply, done: turn.done, options: turn.options };
  } catch {
    // Graceful fallback — keep the conversation alive instead of surfacing an error. Offer a few
    // generic chips so the tile still has tappable answers even when the model call failed.
    return {
      reply: "Got it! Tell me a bit more — what kinds of food do you usually love to eat?",
      done: false,
      options: ["Italian", "Mexican", "Thai", "Indian", "Comfort food"],
    };
  }
}

/**
 * Persist the profile step (name/age/gender) as profile:* preference signals — the SAME semantic-layer
 * persistence signup used to do (source "onboarding_q"; that's the source signup wrote profile facts
 * with, and the only ledger source the projection needs — `projectUserModel` keys on the topic, not
 * the source). Latest-wins by confidence, so a later profile edit overrides this. Best-effort and never
 * throws to the client: a missing session or DB hiccup just no-ops so the flow can advance. Re-projection
 * into the materialized model happens once at the end (`finishOnboardingAction`).
 */
export async function saveProfileAction(profile: ProfileInput): Promise<void> {
  try {
    const userId = await currentUserId();
    if (!userId) return;

    const name = (profile.name ?? "").trim();
    const age = Number((profile.age ?? "").trim());
    const gender = (profile.gender ?? "").trim();

    const signals = [
      ...(name ? [signalFromProfileName(name)] : []),
      ...(Number.isFinite(age) && age > 0 ? [signalFromProfileAge(age)] : []),
      ...(gender ? [signalFromProfileGender(gender)] : []),
    ];
    if (signals.length === 0) return;

    await withTenant(getDb(), userId, async (tx) => {
      for (const s of signals) {
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
  } catch {
    // Best-effort — never block the onboarding flow on a profile save.
  }
}

/**
 * Persist the KEYLESS taste step (the static chip wizard, used when there's no GEMINI_API_KEY). Maps
 * the structured answers → typed signals deterministically (`answersToSignals`) and writes them to the
 * SAME ledger the AI path uses (source "onboarding_q"). No free-text parse here (that needs the model,
 * which is absent on this path) and no budget step. Best-effort; re-projection happens at finish.
 */
export async function saveTasteAction(answers: OnboardingAnswers): Promise<void> {
  try {
    const userId = await currentUserId();
    if (!userId) return;

    const signals = answersToSignals({
      diets: answers.diets ?? [],
      allergens: answers.allergens ?? [],
      lovedCuisines: answers.lovedCuisines ?? [],
      lovedIngredients: answers.lovedIngredients ?? [],
      dislikedIngredients: answers.dislikedIngredients ?? [],
    });
    if (signals.length === 0) return;

    await withTenant(getDb(), userId, async (tx) => {
      for (const s of signals) {
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
  } catch {
    // Best-effort — never block onboarding on a taste save.
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
        // Mark onboarding done so the seeding pages stop showing the "finish setup" affordance —
        // survives every redirect (no fragile query param). Append-only; the check is existence.
        await appendPreferenceSignal(tx, {
          userId,
          topic: "onboarded",
          value: "true",
          polarity: "positive",
          source: "onboarding_q",
          confidence: 1,
        });
      });
    }
  } catch (e) {
    unstable_rethrow(e); // let NEXT_REDIRECT (if any) through; otherwise swallow so finish never blocks
  }
  redirect("/");
}
