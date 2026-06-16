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
    <label key={value} className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white px-3 py-1.5 text-sm text-ink/80">
      <input type="checkbox" name={name} value={value} />
      <span className="capitalize">{value}</span>
    </label>
  );

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/" className="text-sm text-brand-600">← Home</a>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">Tell me your taste</h1>
      <p className="mb-6 text-sm text-ink/60">
        A few quick questions so every plan, recipe, and reorder fits you. Add more anytime — I keep
        learning from what you cook, skip, and reorder.
      </p>

      {hasProfile && (
        <section className="mb-6 rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
          <div className="font-medium">Your profile so far</div>
          <div className="mt-1 text-brand-800/80">
            {model!.diets.length > 0 && <span>Diet: {model!.diets.join(", ")}. </span>}
            {model!.allergens.length > 0 && <span>Avoids: {model!.allergens.join(", ")}. </span>}
            {model!.loves.length > 0 && <span>Loves: {model!.loves.join(", ")}. </span>}
            {model!.dislikes.length > 0 && <span>Not a fan: {model!.dislikes.join(", ")}.</span>}
          </div>
        </section>
      )}

      <form action={saveOnboarding} className="space-y-6">
        <fieldset className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <legend className="px-1 text-sm font-semibold text-ink">Any diets?</legend>
          <div className="mt-2 flex flex-wrap gap-2">{DIETS.map((d) => chk("diets", d))}</div>
        </fieldset>

        <fieldset className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <legend className="px-1 text-sm font-semibold text-ink">Allergies to avoid?</legend>
          <div className="mt-2 flex flex-wrap gap-2">{ALLERGENS.map((a) => chk("allergens", a))}</div>
        </fieldset>

        <fieldset className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <legend className="px-1 text-sm font-semibold text-ink">Cuisines you love?</legend>
          <div className="mt-2 flex flex-wrap gap-2">{CUISINES.map((c) => chk("lovedCuisines", c))}</div>
        </fieldset>

        <fieldset className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <legend className="px-1 text-sm font-semibold text-ink">Quality preferences?</legend>
          <div className="mt-2 flex flex-wrap gap-2">{QUALITY.map((q) => chk("qualityPrefs", q))}</div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-ink">Ingredients you love</span>
            <input
              name="lovedIngredients"
              placeholder="salmon, basil, feta"
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Ingredients you avoid</span>
            <input
              name="dislikedIngredients"
              placeholder="cilantro, olives"
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-ink">Anything else? (in your own words)</span>
          <textarea
            name="freeText"
            rows={3}
            placeholder="We're mostly vegetarian, love spicy Thai, hate mushrooms, and try to eat in on weeknights."
            className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-ink/40">I&apos;ll read this and pull out your preferences.</span>
        </label>

        <label className="block max-w-xs">
          <span className="text-sm font-medium text-ink">Weekly grocery budget (optional)</span>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-ink/50">$</span>
            <input
              name="budget"
              type="number"
              min="0"
              step="5"
              placeholder="120"
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          </div>
        </label>

        <button
          type="submit"
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
        >
          Save & plan my week →
        </button>
      </form>

      {!data.ready && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t reach the database. {data.error?.slice(0, 120)}
        </p>
      )}
    </main>
  );
}
