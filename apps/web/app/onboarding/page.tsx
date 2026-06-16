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

export const dynamic = "force-dynamic";

const DIETS = ["vegetarian", "vegan", "pescatarian", "gluten-free", "dairy-free", "keto", "halal", "kosher"];
const ALLERGENS = ["peanut", "tree nut", "shellfish", "dairy", "egg", "soy", "gluten", "sesame"];
const CUISINES = ["italian", "mexican", "thai", "indian", "chinese", "japanese", "mediterranean", "american"];
const QUALITY = ["organic", "grass-fed", "store-brand"];

const splitCsv = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

async function saveOnboarding(formData: FormData) {
  "use server";
  const answers: OnboardingAnswers = {
    diets: formData.getAll("diets").map(String),
    allergens: formData.getAll("allergens").map(String),
    lovedCuisines: formData.getAll("lovedCuisines").map(String),
    qualityPrefs: formData.getAll("qualityPrefs").map(String),
    lovedIngredients: splitCsv(formData.get("lovedIngredients")),
    dislikedIngredients: splitCsv(formData.get("dislikedIngredients")),
    freeText: String(formData.get("freeText") ?? "") || null,
  };
  const budgetUsd = Number(formData.get("budget"));

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

  redirect("/plan");
}

async function load() {
  try {
    const userId = await currentUserId();
    if (!userId) return { ready: false as const, error: null as string | null };
    const { signals, budgetCents } = await withTenant(getDb(), userId, async (tx) => ({
      signals: await loadPreferenceSignals(tx, userId),
      budgetCents: await getUserBudgetCents(tx, userId),
    }));
    return { ready: true as const, error: null as string | null, model: projectUserModel(signals), budgetCents };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function OnboardingPage() {
  const data = await load();
  const model = data.ready ? data.model : null;
  const hasProfile =
    model && (model.diets.length || model.allergens.length || model.loves.length || model.dislikes.length);

  const chk = (name: string, value: string) => (
    <label key={value} className="chip">
      <input type="checkbox" name={name} value={value} className="control-accent" />
      <span className="capitalize">{value}</span>
    </label>
  );

  return (
    <main className="page">
      <a href="/" className="back-link"><span aria-hidden>←</span> Home</a>
      <div className="mt-4 animate-fade-in-up">
        <p className="eyebrow">Your taste</p>
        <h1 className="page-title mt-2">Tell me your taste</h1>
        <p className="page-subtitle">
          A few quick questions so every plan, recipe, and reorder fits you. Add more anytime — I keep
          learning from what you cook, skip, and reorder.
        </p>
      </div>

      {hasProfile && (
        <section className="card-pad bg-brand-50/60 mt-6 text-sm text-brand-900">
          <div className="font-medium">Your profile so far</div>
          <div className="mt-1 text-brand-800/80">
            {model!.diets.length > 0 && <span>Diet: {model!.diets.join(", ")}. </span>}
            {model!.allergens.length > 0 && <span>Avoids: {model!.allergens.join(", ")}. </span>}
            {model!.loves.length > 0 && <span>Loves: {model!.loves.join(", ")}. </span>}
            {model!.dislikes.length > 0 && <span>Not a fan: {model!.dislikes.join(", ")}.</span>}
          </div>
        </section>
      )}

      <form action={saveOnboarding} className="mt-6 space-y-6">
        <fieldset className="card-pad">
          <legend className="section-title px-1">Any diets?</legend>
          <div className="mt-2 flex flex-wrap gap-2">{DIETS.map((d) => chk("diets", d))}</div>
        </fieldset>

        <fieldset className="card-pad">
          <legend className="section-title px-1">Allergies to avoid?</legend>
          <div className="mt-2 flex flex-wrap gap-2">{ALLERGENS.map((a) => chk("allergens", a))}</div>
        </fieldset>

        <fieldset className="card-pad">
          <legend className="section-title px-1">Cuisines you love?</legend>
          <div className="mt-2 flex flex-wrap gap-2">{CUISINES.map((c) => chk("lovedCuisines", c))}</div>
        </fieldset>

        <fieldset className="card-pad">
          <legend className="section-title px-1">Quality preferences?</legend>
          <div className="mt-2 flex flex-wrap gap-2">{QUALITY.map((q) => chk("qualityPrefs", q))}</div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Ingredients you love</span>
            <input
              name="lovedIngredients"
              placeholder="salmon, basil, feta"
              className="input"
            />
          </label>
          <label className="block">
            <span className="field-label">Ingredients you avoid</span>
            <input
              name="dislikedIngredients"
              placeholder="cilantro, olives"
              className="input"
            />
          </label>
        </div>

        <label className="block">
          <span className="field-label">Anything else? (in your own words)</span>
          <textarea
            name="freeText"
            rows={3}
            placeholder="We're mostly vegetarian, love spicy Thai, hate mushrooms, and try to eat in on weeknights."
            className="input"
          />
          <span className="field-hint">I&apos;ll read this and pull out your preferences.</span>
        </label>

        <label className="block max-w-xs">
          <span className="field-label">Weekly grocery budget (optional)</span>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-ink-400">$</span>
            <input
              name="budget"
              type="number"
              min="0"
              step="5"
              placeholder="120"
              className="input"
            />
          </div>
        </label>

        <button type="submit" className="btn-primary">
          Save & plan my week →
        </button>
      </form>

      {!data.ready && (
        <p className="notice-warn mt-4">
          Couldn&apos;t reach the database. {data.error?.slice(0, 120)}
        </p>
      )}
    </main>
  );
}
