import { redirect } from "next/navigation";
import {
  appendPreferenceSignal,
  getDb,
  getUserBudgetCents,
  loadPreferenceSignals,
  persistUserModel,
  setWeeklyBudgetCents,
  withTenant,
} from "@gm/db";
import {
  answersToSignals,
  parseFreeTextPreferences,
  projectUserModel,
  type OnboardingAnswers,
} from "@gm/core/personalization";
import { getGeminiClient } from "@gm/core/llm";
import { currentUserId } from "@/app/lib/tenant";
import { OnboardingFlow, type OnboardingPrefill, type WizardState } from "./onboarding-flow";

export const dynamic = "force-dynamic";

/**
 * Persist the wizard's full answer set. This is the SAME persistence the old single form used
 * (answersToSignals → optional free-text parse via Gemini → write each signal as source
 * "onboarding_q" → setWeeklyBudgetCents → re-project + persistUserModel) — the only change vs. the
 * previous `saveOnboarding` is the redirect target (now "/" — the home page with bottom-nav tabs —
 * instead of "/plan"). Restructuring is presentation-only; data semantics are untouched.
 */
async function saveOnboarding(state: WizardState) {
  "use server";
  const answers: OnboardingAnswers = {
    diets: state.diets ?? [],
    allergens: state.allergens ?? [],
    lovedCuisines: state.lovedCuisines ?? [],
    qualityPrefs: state.qualityPrefs ?? [],
    lovedIngredients: state.lovedIngredients ?? [],
    dislikedIngredients: state.dislikedIngredients ?? [],
    freeText: state.freeText || null,
  };
  const budgetUsd = Number(state.budget);

  const userId = await currentUserId();
  if (!userId) return;

  let signals = answersToSignals(answers);
  if (answers.freeText && process.env.GEMINI_API_KEY) {
    const parsed = await parseFreeTextPreferences(getGeminiClient(), answers.freeText);
    signals = [...signals, ...parsed];
  }

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
    if (Number.isFinite(budgetUsd) && budgetUsd > 0) {
      await setWeeklyBudgetCents(tx, userId, Math.round(budgetUsd * 100));
    }
    // Re-project the ledger into the materialized UserModel (the ratchet stays in sync).
    const model = projectUserModel(await loadPreferenceSignals(tx, userId));
    await persistUserModel(tx, userId, {
      diets: model.diets,
      allergens: model.allergens,
      cuisineAffinity: model.cuisineAffinity,
      qualityPrefs: model.qualityPrefs,
      confidencePerField: model.confidencePerField,
    });
  });

  redirect("/");
}

/**
 * Load the user's existing model so a re-visit (e.g. from /tools) can prefill the chips and inputs
 * with what's already set. `loves`/`dislikes` carry cuisines as "cuisine:<x>"; the wizard's loved-
 * ingredient inputs only want plain ingredient keys, so we strip the cuisine-prefixed entries.
 */
async function loadPrefill(): Promise<OnboardingPrefill> {
  const empty: OnboardingPrefill = {
    diets: [],
    allergens: [],
    lovedCuisines: [],
    lovedIngredients: [],
    dislikedIngredients: [],
    budget: "",
  };
  try {
    const userId = await currentUserId();
    if (!userId) return empty;
    const { signals, budgetCents } = await withTenant(getDb(), userId, async (tx) => ({
      signals: await loadPreferenceSignals(tx, userId),
      budgetCents: await getUserBudgetCents(tx, userId),
    }));
    const model = projectUserModel(signals);
    const lovedCuisines = Object.entries(model.cuisineAffinity)
      .filter(([, a]) => a > 0.3)
      .map(([k]) => k);
    const isCuisine = (s: string) => s.startsWith("cuisine:");
    return {
      diets: model.diets,
      allergens: model.allergens,
      lovedCuisines,
      lovedIngredients: model.loves.filter((s) => !isCuisine(s)),
      dislikedIngredients: model.dislikes.filter((s) => !isCuisine(s)),
      budget: budgetCents && budgetCents > 0 ? String(Math.round(budgetCents / 100)) : "",
    };
  } catch {
    // DB unreachable — start the flow empty rather than blocking onboarding.
    return empty;
  }
}

export default async function OnboardingPage() {
  const prefill = await loadPrefill();
  return <OnboardingFlow prefill={prefill} onFinish={saveOnboarding} />;
}
