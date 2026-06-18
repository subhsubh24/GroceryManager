"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import type { OnboardingAnswers } from "@gm/core/personalization";

/**
 * Guided onboarding wizard (presentation only). Research-backed shape: ONE topic per screen, a
 * progress bar that starts partially filled (so it feels achievable), value-framed microcopy, and
 * Skip/Back on every step so the user is never forced to answer. All answers live in local state;
 * nothing is persisted until the user finishes (or "skips the rest"), at which point we hand the
 * complete answer set to the server `onFinish` action — which reuses the EXACT same persistence as
 * the old single form (answersToSignals → optional free-text parse → onboarding_q signals →
 * setWeeklyBudgetCents → persistUserModel) and then redirect("/").
 *
 * The save logic is untouched on purpose: this file changes only the flow/presentation. It must stay
 * free of server-only imports (it's a client component) — it depends on `@gm/core/personalization`
 * for the `OnboardingAnswers` TYPE only, which is erased at build time.
 */

const DIETS = ["vegetarian", "vegan", "pescatarian", "gluten-free", "dairy-free", "keto", "halal", "kosher"];
const ALLERGENS = ["peanut", "tree nut", "shellfish", "dairy", "egg", "soy", "gluten", "sesame"];
const CUISINES = ["italian", "mexican", "thai", "indian", "chinese", "japanese", "mediterranean", "american"];

/**
 * The payload handed to the server action — the SAME shape the old form produced (OnboardingAnswers
 * with array fields), plus a UI-only `budget` string in dollars. The wizard keeps the two free-text
 * ingredient fields as raw strings in local UI state and only splits them into arrays here, so the
 * user can type commas freely (a controlled `value={join(split(text))}` round-trip would otherwise
 * strip the separator on every keystroke).
 */
export type WizardState = OnboardingAnswers & { budget: string };

export type OnboardingPrefill = {
  diets: string[];
  allergens: string[];
  lovedCuisines: string[];
  lovedIngredients: string[];
  dislikedIngredients: string[];
  budget: string;
};

const splitCsv = (v: string) =>
  v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const joinCsv = (xs: string[] | undefined) => (xs ?? []).join(", ");

// Local wizard UI state. Multi-select groups + budget mirror the payload; the two ingredient fields
// are raw text (split into arrays only when we build the WizardState payload at finish).
type UiState = {
  diets: string[];
  allergens: string[];
  lovedCuisines: string[];
  lovedText: string;
  dislikedText: string;
  freeText: string;
  budget: string;
};

export function OnboardingFlow({
  prefill,
  onFinish,
}: {
  prefill: OnboardingPrefill;
  // Server action: persists the full answer set and redirects to "/". Throws NEXT_REDIRECT on success.
  onFinish: (state: WizardState) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const [state, setState] = useState<UiState>({
    diets: prefill.diets,
    allergens: prefill.allergens,
    lovedCuisines: prefill.lovedCuisines,
    lovedText: joinCsv(prefill.lovedIngredients),
    dislikedText: joinCsv(prefill.dislikedIngredients),
    freeText: "",
    budget: prefill.budget,
  });

  // Toggle a value in a multi-select chip group, preserving the rest of the state.
  const toggle = (field: "diets" | "allergens" | "lovedCuisines", value: string) =>
    setState((s) => {
      const cur = s[field] ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...s, [field]: next };
    });

  // Steps after the Welcome screen (index 0). The final "Done" step is the last entry.
  // Each question step is fully skippable — Skip just advances without changing state.
  const QUESTION_STEPS = 5; // diets, allergies, cuisines, loves/dislikes, budget+freetext
  const TOTAL_STEPS = QUESTION_STEPS + 2; // + Welcome (0) + Done (last)
  const LAST_STEP = TOTAL_STEPS - 1; // the Done/celebrate screen
  const isWelcome = step === 0;
  const isDone = step === LAST_STEP;

  const go = (n: number) => setStep(Math.max(0, Math.min(LAST_STEP, n)));
  const next = () => go(step + 1);
  const back = () => go(step - 1);
  // "Skip the rest" jumps straight to the celebrate step (nothing is lost — state persists).
  const skipToEnd = () => go(LAST_STEP);

  const finish = () => {
    setError(false);
    // Build the SAME payload the old form sent: arrays for the multi-selects + the two ingredient
    // fields split here (kept as raw text in UI state so the user can type commas freely).
    const payload: WizardState = {
      diets: state.diets,
      allergens: state.allergens,
      lovedCuisines: state.lovedCuisines,
      lovedIngredients: splitCsv(state.lovedText),
      dislikedIngredients: splitCsv(state.dislikedText),
      freeText: state.freeText || null,
      budget: state.budget,
    };
    startTransition(async () => {
      try {
        // On success the server action calls redirect("/"), which surfaces here as a thrown
        // NEXT_REDIRECT — it MUST propagate so Next's RedirectBoundary performs the navigation.
        // Swallowing it would persist the data but strand the user on this screen.
        await onFinish(payload);
      } catch (e) {
        unstable_rethrow(e); // re-throw framework control-flow (NEXT_REDIRECT) so navigation happens
        setError(true); // a real save failure — surface it instead of dropping it silently
      }
    });
  };

  // Progress bar: starts partially filled at Welcome (1 of N) so it feels achievable, fills to 100%.
  const progressPct = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-8 sm:px-6">
      {/* Progress: a calm bar plus a "Step N of M" label. Hidden on Welcome's label, shown as a count. */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-medium text-ink-400">
          <span>{isDone ? "All done" : isWelcome ? "Getting started" : `Step ${step} of ${QUESTION_STEPS}`}</span>
          <span aria-hidden>{progressPct}%</span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-100"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Onboarding progress"
        >
          <div
            className="h-full rounded-full bg-brand-solid transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* One step at a time. `key` on the wrapper re-triggers the gentle fade between steps. */}
      <div key={step} className="flex-1 animate-fade-in">
        {isWelcome && (
          <Welcome onStart={next} />
        )}

        {step === 1 && (
          <Step
            emoji="🥗"
            title="Any diets you follow?"
            blurb="So every plan and recipe respects how you eat. Pick all that apply — or skip."
          >
            <ChipGroup options={DIETS} selected={state.diets ?? []} onToggle={(v) => toggle("diets", v)} />
          </Step>
        )}

        {step === 2 && (
          <Step
            emoji="🚫"
            title="Anything you're allergic to?"
            blurb="We'll keep these out of every suggestion. This one matters — but it's still optional."
          >
            <ChipGroup
              options={ALLERGENS}
              selected={state.allergens ?? []}
              onToggle={(v) => toggle("allergens", v)}
            />
          </Step>
        )}

        {step === 3 && (
          <Step
            emoji="🌍"
            title="Cuisines you love?"
            blurb="We'll lean into these when we suggest what to cook. Tap a few favorites."
          >
            <ChipGroup
              options={CUISINES}
              selected={state.lovedCuisines ?? []}
              onToggle={(v) => toggle("lovedCuisines", v)}
            />
          </Step>
        )}

        {step === 4 && (
          <Step
            emoji="❤️"
            title="Loves & dislikes"
            blurb="A few ingredients to lean toward — and a few to avoid. Recipes get tuned to both."
          >
            <div className="space-y-4">
              <label className="block">
                <span className="field-label">Ingredients you love</span>
                <input
                  value={state.lovedText}
                  onChange={(e) => setState((s) => ({ ...s, lovedText: e.target.value }))}
                  placeholder="salmon, basil, feta"
                  className="input"
                />
              </label>
              <label className="block">
                <span className="field-label">Ingredients you avoid</span>
                <input
                  value={state.dislikedText}
                  onChange={(e) => setState((s) => ({ ...s, dislikedText: e.target.value }))}
                  placeholder="cilantro, olives"
                  className="input"
                />
              </label>
            </div>
          </Step>
        )}

        {step === 5 && (
          <Step
            emoji="💸"
            title="Budget & anything else"
            blurb="An optional weekly target keeps plans in range — and tell us anything else in your own words."
          >
            <div className="space-y-4">
              <label className="block max-w-xs">
                <span className="field-label">Weekly grocery budget (optional)</span>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-ink-400">$</span>
                  <input
                    value={state.budget}
                    onChange={(e) => setState((s) => ({ ...s, budget: e.target.value }))}
                    type="number"
                    min="0"
                    step="5"
                    placeholder="120"
                    className="input"
                  />
                </div>
              </label>
              <label className="block">
                <span className="field-label">Anything else? (in your own words)</span>
                <textarea
                  value={state.freeText ?? ""}
                  onChange={(e) => setState((s) => ({ ...s, freeText: e.target.value }))}
                  rows={3}
                  placeholder="We're mostly vegetarian, love spicy Thai, hate mushrooms, and try to eat in on weeknights."
                  className="input"
                />
                <span className="field-hint">We&apos;ll read this and pull out your preferences.</span>
              </label>
            </div>
          </Step>
        )}

        {isDone && <Done state={state} pending={pending} error={error} onFinish={finish} />}
      </div>

      {/* Footer controls. Hidden on Welcome (it has its own CTA) and Done (its own finish button). */}
      {!isWelcome && !isDone && (
        <div className="mt-8 flex items-center justify-between gap-3">
          <button type="button" onClick={back} className="btn-ghost">
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={skipToEnd} className="btn-ghost btn-sm">
              Skip the rest
            </button>
            <button type="button" onClick={next} className="btn-primary">
              {step === QUESTION_STEPS ? "Review →" : "Next →"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/** A single centered question screen — emoji, title, value-framed blurb, then its interaction. */
function Step({
  emoji,
  title,
  blurb,
  children,
}: {
  emoji: string;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-3xl">
        {emoji}
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.01em] text-ink-900">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">{blurb}</p>
      <div className="mt-7 text-left">{children}</div>
    </section>
  );
}

/** Welcome / value-framing screen. Counts as step 0; not a question. */
function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <section className="flex flex-col items-center text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-3xl shadow-brand">
        🧺
      </span>
      <h1 className="mt-6 text-3xl font-semibold tracking-[-0.02em] text-ink-900">Welcome to GroceryManager</h1>
      <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-ink-500">
        A minute of setup so every recipe, plan, and list fits you. A few quick questions — skip any of
        them, and tweak anytime later.
      </p>
      <button type="button" onClick={onStart} className="btn-primary mt-8">
        Let&apos;s go →
      </button>
    </section>
  );
}

/** Final celebrate screen — a 1-line summary of what was captured + the finishing CTA. */
function Done({
  state,
  pending,
  error,
  onFinish,
}: {
  state: UiState;
  pending: boolean;
  error: boolean;
  onFinish: () => void;
}) {
  const loves = splitCsv(state.lovedText);
  const dislikes = splitCsv(state.dislikedText);
  const parts: string[] = [];
  if (state.diets.length) parts.push(`diet: ${state.diets.join(", ")}`);
  if (state.allergens.length) parts.push(`avoiding ${state.allergens.join(", ")}`);
  if (state.lovedCuisines.length) parts.push(`loves ${state.lovedCuisines.join(", ")}`);
  if (loves.length) parts.push(`+${loves.join(", ")}`);
  if (dislikes.length) parts.push(`-${dislikes.join(", ")}`);
  if (state.budget && Number(state.budget) > 0) parts.push(`~$${state.budget}/wk`);
  const summary = parts.length
    ? parts.join(" · ")
    : "We'll start learning your taste from what you cook, save, and skip.";

  return (
    <section className="flex flex-col items-center text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-4xl">✨</span>
      <h1 className="mt-6 text-3xl font-semibold tracking-[-0.02em] text-ink-900">You&apos;re all set</h1>
      <p className="mx-auto mt-3 max-w-md text-[0.95rem] leading-relaxed text-ink-500">{summary}</p>
      <button type="button" onClick={onFinish} disabled={pending} className="btn-primary mt-8">
        {pending ? "Saving…" : "Go to my kitchen →"}
      </button>
      {error && (
        <p className="notice-warn mt-4 max-w-md">
          We couldn&apos;t save just now — please try again.
        </p>
      )}
      <p className="mt-3 text-xs text-ink-400">You can refine all of this anytime from Tools.</p>
    </section>
  );
}

/** Multi-select chip group (controlled). Mirrors the calm `.chip` look without form checkboxes. */
function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(opt)}
            // Reuse the calm `.chip` base (layout + idle/hover); layer the selected palette on top.
            // `.chip`'s own selected state keys off `:checked`, which a button doesn't have, so the
            // brand colors are applied here when `on` (they override `.chip`'s idle border/bg/text).
            className={`chip capitalize ${on ? "border-brand-300 bg-brand-50 text-brand-800" : ""}`}
          >
            {on && <span aria-hidden>✓</span>}
            {opt}
          </button>
        );
      })}
    </div>
  );
}
