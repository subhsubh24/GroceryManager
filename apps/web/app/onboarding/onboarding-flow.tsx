"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import type { OnboardingAnswers } from "@gm/core/personalization";
import {
  finishOnboardingAction,
  finishOnboardingHouseholdAction,
  onboardingTurnAction,
  saveProfileAction,
  saveTasteAction,
  type OnboardingMessage,
  type ProfileInput,
} from "./actions";
import {
  BackIcon,
  CheckIcon,
  ChevronRightIcon,
  DoneIcon,
  HouseholdIcon,
  ItemsIcon,
  NextIcon,
  ProfileIcon,
  QuickAddIcon,
  ReceiptsIcon,
  ScanIcon,
  SpinnerIcon,
  TasteIcon,
} from "./icons";
import { humanize } from "@/app/lib/format";

/**
 * Onboarding as a TILE step-flow (mobile-first) — a clean ONE-STEP-PER-SCREEN flow in a centered
 * card, NOT a chat. Four macro steps: Profile → Taste → Add first items → Done. A top segmented
 * progress indicator, a Back affordance, and Skip where it makes sense.
 *
 * The TASTE step renders the SAME adaptive engine either way, just never as a chat bubble:
 *   • AI (a GEMINI_API_KEY is configured): each `nextOnboardingTurn` turn becomes a tile — the
 *     model's question is the step heading, with its suggested `options` as tappable chips plus a
 *     small "type your own" input. Each answer advances to the next adaptive question.
 *   • Keyless fallback: the deterministic chip wizard, restyled to match (diets → allergies →
 *     cuisines → loves/dislikes), persisted via `saveTasteAction`.
 *
 * Persistence reuses the SAME server actions/ledger as before — profile facts (`saveProfileAction`),
 * taste signals (the AI turn action / `saveTasteAction`), then `finishOnboardingAction` re-projects
 * the materialized model and redirects to "/". This is a client component: it holds all wizard state
 * locally, never touches `window`/`document` during render, and reaches the server-only LLM strictly
 * through the server actions — so it hydrates cleanly.
 *
 * iPhone specifics: full dynamic-viewport height, a single column, safe-area insets top + bottom,
 * 16px input text (so iOS Safari doesn't zoom on focus), ≥44px tap targets, and no horizontal overflow.
 */

const MACRO_STEPS = ["Profile", "Taste", "Items", "Done"] as const;

// Keyless static taste wizard — restyled to match the AI tiles. One topic per sub-screen.
const DIETS = ["vegetarian", "vegan", "pescatarian", "gluten-free", "dairy-free", "keto", "halal", "kosher"];
const ALLERGENS = ["peanut", "tree nut", "shellfish", "dairy", "egg", "soy", "gluten", "sesame"];
const CUISINES = ["italian", "mexican", "thai", "indian", "chinese", "japanese", "mediterranean", "american"];
const GENDERS = ["female", "male", "non-binary", "prefer not to say"];

const splitCsv = (v: string) =>
  v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

type Profile = { name: string; age: string; gender: string };

export function OnboardingFlow({
  hasAi,
  householdsLive = false,
}: {
  hasAi: boolean;
  householdsLive?: boolean;
}) {
  const [macro, setMacro] = useState(0); // 0 profile · 1 taste · 2 items · 3 done
  const [profile, setProfile] = useState<Profile>({ name: "", age: "", gender: "" });
  // Bumped each time we move forward so the active step gets a fresh `key` → one purposeful transition.
  const [dir, setDir] = useState(0);

  const [savingProfile, startProfile] = useTransition();
  const [finishing, startFinish] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const advance = () => {
    setError(null);
    setDir((d) => d + 1);
    setMacro((m) => Math.min(MACRO_STEPS.length - 1, m + 1));
  };
  const back = () => {
    setError(null);
    setDir((d) => d + 1);
    setMacro((m) => Math.max(0, m - 1));
  };

  // Profile → persist as profile:* signals, then advance. Save is best-effort (never blocks the flow).
  function submitProfile() {
    if (savingProfile) return;
    const payload: ProfileInput = { name: profile.name, age: profile.age, gender: profile.gender };
    startProfile(async () => {
      try {
        await saveProfileAction(payload);
      } catch {
        /* best-effort — advance regardless so the user is never stuck on profile */
      }
      advance();
    });
  }

  // Finish (from Done): re-project + redirect. The action throws NEXT_REDIRECT on success — it MUST
  // propagate so Next navigates; `unstable_rethrow` lets it through. A genuine error surfaces.
  // `toHousehold` routes through the sibling action that lands on /household (the "cook together"
  // moment) while running the exact same finish — so the user is never stranded mid-flow.
  function finish(toHousehold = false) {
    if (finishing) return;
    setError(null);
    startFinish(async () => {
      try {
        await (toHousehold ? finishOnboardingHouseholdAction() : finishOnboardingAction());
      } catch (e) {
        unstable_rethrow(e);
        setError("Couldn't wrap up just now — please try again.");
      }
    });
  }

  return (
    <main className="flex min-h-dvh w-full flex-col bg-cream pt-[env(safe-area-inset-top)] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      {/* Centered, properly-sized column — not a full-width empty canvas. */}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5">
        <ProgressBar current={macro} />

        {/* The active step. `key` re-mounts on each navigation → the single, purposeful step transition. */}
        <div key={`${macro}-${dir}`} className="onboarding-step flex flex-1 flex-col pt-8">
          {macro === 0 && (
            <ProfileStep
              profile={profile}
              setProfile={setProfile}
              onNext={submitProfile}
              saving={savingProfile}
            />
          )}

          {macro === 1 &&
            (hasAi ? (
              <TasteStepAI onDone={advance} onBack={back} />
            ) : (
              <TasteStepStatic onDone={advance} onBack={back} />
            ))}

          {macro === 2 && <ItemsStep onContinue={advance} onBack={back} />}

          {macro === 3 && (
            <DoneStep
              onFinish={finish}
              finishing={finishing}
              error={error}
              householdsLive={householdsLive}
            />
          )}
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Shared chrome                                                                                     */
/* ------------------------------------------------------------------------------------------------ */

/** Top progress: a segmented indicator (one segment per macro step) + a quiet "Step N of M" label. */
function ProgressBar({ current }: { current: number }) {
  const total = MACRO_STEPS.length;
  return (
    <div className="pt-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
          {MACRO_STEPS[current]}
        </p>
        <p className="text-xs font-medium text-ink-400" aria-hidden>
          Step {current + 1} of {total}
        </p>
      </div>
      <div
        className="mt-2.5 flex gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current + 1}
        aria-label={`Onboarding — step ${current + 1} of ${total}`}
      >
        {MACRO_STEPS.map((label, i) => (
          <span
            key={label}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i <= current ? "bg-brand-solid" : "bg-ink-100"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A step header — icon tile (Lucide, never emoji), title, and a value-framed line. Left-aligned.
 * `liveTitle` makes the heading an `aria-live` region: use it on the AI taste step, whose question
 * updates IN PLACE each turn, so a screen reader announces each new adaptive question. (Other steps
 * remount with a fresh heading, so they don't need it.)
 */
function StepHeader({
  icon,
  title,
  blurb,
  liveTitle = false,
}: {
  icon: React.ReactNode;
  title: string;
  blurb: string;
  liveTitle?: boolean;
}) {
  return (
    <header>
      <span className="tile-brand h-12 w-12">{icon}</span>
      <h1
        className="mt-4 text-[1.65rem] font-bold leading-[1.15] tracking-[-0.02em] text-ink-900"
        aria-live={liveTitle ? "polite" : undefined}
        aria-atomic={liveTitle ? true : undefined}
      >
        {title}
      </h1>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-500">{blurb}</p>
    </header>
  );
}

/**
 * Footer nav row. `onBack` renders a Back affordance; the right slot holds Skip / Next / primary.
 * `backDisabled` blocks Back while a step has work in flight (e.g. an AI turn resolving) so the user
 * can't navigate away mid-action and trigger a state update on a step that's already been left.
 */
function StepFooter({
  onBack,
  backDisabled = false,
  children,
}: {
  onBack?: () => void;
  backDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3 pt-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={backDisabled}
          className="btn-secondary min-h-[44px]"
        >
          <BackIcon className="h-4 w-4" aria-hidden />
          Back
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Step 1 — Profile                                                                                  */
/* ------------------------------------------------------------------------------------------------ */

function ProfileStep({
  profile,
  setProfile,
  onNext,
  saving,
}: {
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<Profile>>;
  onNext: () => void;
  saving: boolean;
}) {
  return (
    <section className="flex flex-1 flex-col">
      <StepHeader
        icon={<ProfileIcon className="h-6 w-6" aria-hidden />}
        title="A little about you"
        blurb="So plans and recipes feel made for you. You can edit any of this later."
      />

      <form
        className="mt-7 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onNext();
        }}
      >
        <label className="block">
          <span className="field-label">Name</span>
          <input
            value={profile.name}
            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            type="text"
            autoComplete="name"
            placeholder="What should we call you?"
            className="input-lg"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="field-label">Age</span>
            <input
              value={profile.age}
              onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))}
              type="number"
              min="1"
              max="120"
              inputMode="numeric"
              placeholder="—"
              className="input-lg"
            />
          </label>
          <label className="block">
            <span className="field-label">Gender</span>
            <select
              value={profile.gender}
              onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))}
              className="select-lg"
            >
              <option value="">—</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Submit lives in the footer for layout, but this hidden submit lets Enter advance the form. */}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>
          Continue
        </button>
      </form>

      <div className="flex-1" />

      <StepFooter>
        <button
          type="button"
          onClick={onNext}
          disabled={saving}
          className="btn-primary min-h-[44px] px-5"
        >
          {saving ? (
            <SpinnerIcon className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <>
              Continue
              <NextIcon className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      </StepFooter>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Step 2a — Taste (AI-adaptive). One question per screen, rendered as a tile (chips + free input).  */
/* ------------------------------------------------------------------------------------------------ */

// Q1 is broad on purpose (diet AND allergies in one), so a single screen captures a lot.
const AI_GREETING = "How do you eat — any diets or allergies we should plan around?";
const AI_GREETING_OPTIONS = [
  "I eat everything",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Gluten-free",
  "Dairy-free",
  "Nut allergy",
  "Halal",
];
// Hard cap so onboarding stays short no matter what the model returns (it's also told to stop by 3).
const MAX_AI_QUESTIONS = 3;

function TasteStepAI({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  // The transcript we send to the model (assistant questions + user answers). Seeded with the opening
  // question client-side so the first tile shows instantly (no server round-trip to render it).
  const [transcript, setTranscript] = useState<OnboardingMessage[]>([
    { role: "assistant", content: AI_GREETING },
  ]);
  const [question, setQuestion] = useState(AI_GREETING);
  const [options, setOptions] = useState<string[]>(AI_GREETING_OPTIONS);
  // MULTI-select for the current question — tap several chips, optionally add free text, then Continue.
  // Capturing many answers per question is the whole point: max signal, fewest questions.
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [answered, setAnswered] = useState(0); // questions answered so far (drives the hard cap)
  const [pending, startTurn] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const togglePick = (opt: string) =>
    setPicked((p) => (p.includes(opt) ? p.filter((x) => x !== opt) : [...p, opt]));

  function submitAnswer() {
    if (pending) return;
    const parts = [...picked];
    if (custom.trim()) parts.push(custom.trim());
    const content = parts.join(", ").trim();
    if (!content) return;
    setError(null);
    const next: OnboardingMessage[] = [...transcript, { role: "user", content }];
    setTranscript(next);
    const answeredNow = answered + 1;
    startTurn(async () => {
      try {
        const { reply, done, options: nextOptions } = await onboardingTurnAction(next);
        // Stop when the model says so OR we hit the cap — onboarding never drags past a few questions.
        if (done || answeredNow >= MAX_AI_QUESTIONS) {
          onDone();
          return;
        }
        setTranscript((t) => [...t, { role: "assistant", content: reply }]);
        setQuestion(reply);
        setOptions(nextOptions);
        setPicked([]);
        setCustom("");
        setAnswered(answeredNow);
      } catch {
        // The server action self-bounds the LLM call and normally returns a graceful fallback, so a
        // hard reject here is rare (e.g. a network blip). Don't dead-end onboarding: advance with a
        // generic question + tappable chips and clear the inputs so the user can always keep going
        // (or Skip). Onboarding is best-effort — never trap the user on a model hiccup.
        setTranscript((t) => [
          ...t,
          { role: "assistant", content: "Got it! What kinds of food do you usually love to eat?" },
        ]);
        setQuestion("Got it! What kinds of food do you usually love to eat?");
        setOptions(["Italian", "Mexican", "Thai", "Indian", "Comfort food"]);
        setPicked([]);
        setCustom("");
        setAnswered(answeredNow);
      }
    });
  }

  const canContinue = picked.length > 0 || custom.trim().length > 0;

  return (
    <section className="flex flex-1 flex-col">
      <StepHeader
        icon={<TasteIcon className="h-6 w-6" aria-hidden />}
        title={question}
        blurb="Pick any that apply — or add your own. Just a couple of quick questions, then you're in."
        liveTitle
      />

      <div className="mt-6 flex-1">
        {pending ? (
          <p className="flex items-center gap-2 text-sm text-ink-400" role="status">
            <SpinnerIcon className="h-4 w-4 animate-spin" aria-hidden />
            One sec…
          </p>
        ) : (
          <>
            {options.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                  const on = picked.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePick(opt)}
                      className={`chip-tap ${on ? "chip-tap-on" : ""}`}
                    >
                      {on && <CheckIcon className="h-3.5 w-3.5" aria-hidden />}
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                submitAnswer();
              }}
            >
              <label htmlFor="taste-custom" className="sr-only">
                Add your own
              </label>
              <input
                id="taste-custom"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                type="text"
                placeholder="Add your own…"
                autoComplete="off"
                enterKeyHint="next"
                className="input-lg w-full"
              />
            </form>

            {error && <p className="notice-warn mt-4">{error}</p>}
          </>
        )}
      </div>

      <StepFooter onBack={onBack} backDisabled={pending}>
        <button type="button" onClick={onDone} disabled={pending} className="btn-ghost min-h-[44px]">
          Skip
        </button>
        <button
          type="button"
          onClick={submitAnswer}
          disabled={pending || !canContinue}
          className="btn-primary min-h-[44px] px-5"
        >
          Continue
          <NextIcon className="h-4 w-4" aria-hidden />
        </button>
      </StepFooter>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Step 2b — Taste (keyless static wizard, restyled to match). Diets → allergies → cuisines → loves. */
/* ------------------------------------------------------------------------------------------------ */

type StaticState = {
  diets: string[];
  allergens: string[];
  lovedCuisines: string[];
  lovedText: string;
  dislikedText: string;
};

const STATIC_SUBSTEPS = 2;

function TasteStepStatic({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [sub, setSub] = useState(0);
  const [state, setState] = useState<StaticState>({
    diets: [],
    allergens: [],
    lovedCuisines: [],
    lovedText: "",
    dislikedText: "",
  });
  const [saving, startSave] = useTransition();

  const toggle = (field: "diets" | "allergens" | "lovedCuisines", value: string) =>
    setState((s) => {
      const cur = s[field];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...s, [field]: next };
    });

  // Persist on the way out of the LAST sub-step (or on Skip), then hand control back to the macro flow.
  function persistAndDone() {
    const answers: OnboardingAnswers = {
      diets: state.diets,
      allergens: state.allergens,
      lovedCuisines: state.lovedCuisines,
      lovedIngredients: splitCsv(state.lovedText),
      dislikedIngredients: splitCsv(state.dislikedText),
    };
    startSave(async () => {
      try {
        await saveTasteAction(answers);
      } catch {
        /* best-effort — advance regardless */
      }
      onDone();
    });
  }

  const nextSub = () => {
    if (sub >= STATIC_SUBSTEPS - 1) persistAndDone();
    else setSub((s) => s + 1);
  };
  const backSub = () => {
    if (sub === 0) onBack();
    else setSub((s) => s - 1);
  };

  return (
    <section className="flex flex-1 flex-col">
      {sub === 0 && (
        <StepHeader
          icon={<TasteIcon className="h-6 w-6" aria-hidden />}
          title="How you eat"
          blurb="Diets to follow and anything to keep out — pick all that apply, or skip."
        />
      )}
      {sub === 1 && (
        <StepHeader
          icon={<TasteIcon className="h-6 w-6" aria-hidden />}
          title="What you love"
          blurb="Cuisines and ingredients to lean toward — and a few to avoid. All optional."
        />
      )}

      <div className="mt-6 flex-1 space-y-6">
        {sub === 0 && (
          <>
            <div>
              <p className="field-label mb-2">Diets</p>
              <ChipMultiSelect options={DIETS} selected={state.diets} onToggle={(v) => toggle("diets", v)} />
            </div>
            <div>
              <p className="field-label mb-2">Allergies</p>
              <ChipMultiSelect
                options={ALLERGENS}
                selected={state.allergens}
                onToggle={(v) => toggle("allergens", v)}
              />
            </div>
          </>
        )}
        {sub === 1 && (
          <>
            <div>
              <p className="field-label mb-2">Cuisines you love</p>
              <ChipMultiSelect
                options={CUISINES}
                selected={state.lovedCuisines}
                onToggle={(v) => toggle("lovedCuisines", v)}
              />
            </div>
            <label className="block">
              <span className="field-label">Ingredients you love</span>
              <input
                value={state.lovedText}
                onChange={(e) => setState((s) => ({ ...s, lovedText: e.target.value }))}
                placeholder="salmon, basil, feta"
                className="input-lg"
              />
            </label>
            <label className="block">
              <span className="field-label">Ingredients you avoid</span>
              <input
                value={state.dislikedText}
                onChange={(e) => setState((s) => ({ ...s, dislikedText: e.target.value }))}
                placeholder="cilantro, olives"
                className="input-lg"
              />
            </label>
          </>
        )}
      </div>

      <StepFooter onBack={backSub}>
        <button type="button" onClick={persistAndDone} disabled={saving} className="btn-ghost min-h-[44px]">
          Skip taste
        </button>
        <button type="button" onClick={nextSub} disabled={saving} className="btn-primary min-h-[44px] px-5">
          {saving ? (
            <SpinnerIcon className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <>
              {sub >= STATIC_SUBSTEPS - 1 ? "Done" : "Next"}
              <NextIcon className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      </StepFooter>
    </section>
  );
}

/** Multi-select chip group (controlled). A solid, tappable chip; the selected state is the accent. */
function ChipMultiSelect({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(opt)}
            className={`chip-tap ${on ? "chip-tap-on" : ""}`}
          >
            {on && <CheckIcon className="h-3.5 w-3.5" aria-hidden />}
            {humanize(opt)}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Step 3 — Add your first items (skippable)                                                         */
/* ------------------------------------------------------------------------------------------------ */

// Each seeding entrypoint carries ?from=onboarding so the destination shows a "Finish setup → my
// kitchen" bar (instead of dead-ending) — see OnboardingFinish.
const ITEM_ACTIONS: { href: string; label: string; blurb: string; icon: React.ReactNode }[] = [
  {
    href: "/scan?from=onboarding",
    label: "Scan your fridge",
    blurb: "Snap a photo and we'll read what's inside.",
    icon: <ScanIcon className="h-5 w-5" aria-hidden />,
  },
  {
    href: "/capture?from=onboarding",
    label: "Quick add",
    blurb: "Type a few items to fill your pantry fast.",
    icon: <QuickAddIcon className="h-5 w-5" aria-hidden />,
  },
  {
    href: "/pantry?from=onboarding",
    label: "Connect receipts",
    blurb: "Import purchases to keep stock in sync.",
    icon: <ReceiptsIcon className="h-5 w-5" aria-hidden />,
  },
];

function ItemsStep({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  return (
    <section className="flex flex-1 flex-col">
      <StepHeader
        icon={<ItemsIcon className="h-6 w-6" aria-hidden />}
        title="Add your first items"
        blurb="Fill your pantry so we can suggest meals you can cook right now. Pick a way to start."
      />

      <div className="mt-6 flex-1 space-y-3">
        {ITEM_ACTIONS.map((a) => (
          <a
            key={a.href}
            href={a.href}
            className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50/40"
          >
            <span className="tile-brand h-11 w-11">{a.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink-900">{a.label}</span>
              <span className="block text-xs leading-relaxed text-ink-500">{a.blurb}</span>
            </span>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-300" aria-hidden />
          </a>
        ))}
      </div>

      <StepFooter onBack={onBack}>
        <button type="button" onClick={onContinue} className="btn-primary min-h-[44px] px-5">
          I&apos;ll do this later
          <NextIcon className="h-4 w-4" aria-hidden />
        </button>
      </StepFooter>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Step 4 — Done                                                                                     */
/* ------------------------------------------------------------------------------------------------ */

function DoneStep({
  onFinish,
  finishing,
  error,
  householdsLive,
}: {
  onFinish: (toHousehold?: boolean) => void;
  finishing: boolean;
  error: string | null;
  householdsLive: boolean;
}) {
  return (
    <section className="flex flex-1 flex-col">
      <StepHeader
        icon={<DoneIcon className="h-6 w-6" aria-hidden />}
        title="You're all set"
        blurb="Your kitchen is tuned to your taste. We'll keep learning from what you cook, save, and skip."
      />

      <div className="flex-1" />

      {/* "Cook together" moment — only when household sharing is actually live (matches the paywall's
          store-honesty gating, so onboarding never sells a dark feature). Tapping it runs the SAME
          finish (re-project + mark onboarded) but lands on /household so the user can invite their
          people right away. Highest-intent moment to surface the Family value prop; no adoption is
          assumed anywhere in the business case. */}
      {householdsLive && (
        <button
          type="button"
          onClick={() => onFinish(true)}
          disabled={finishing}
          className="mb-4 flex w-full items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50/40 disabled:opacity-60"
        >
          <span className="tile-brand h-11 w-11">
            <HouseholdIcon className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink-900">Cooking with a household?</span>
            <span className="block text-xs leading-relaxed text-ink-500">
              Share one pantry &amp; shopping list with up to 5 people on the Family plan.
            </span>
          </span>
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-300" aria-hidden />
        </button>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onFinish(false)}
          disabled={finishing}
          className="btn-primary btn-block min-h-[48px] text-base"
        >
          {finishing ? (
            <SpinnerIcon className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <>
              Go to my kitchen
              <NextIcon className="h-5 w-5" aria-hidden />
            </>
          )}
        </button>
        {error && <p className="notice-warn">{error}</p>}
        <p className="text-center text-xs text-ink-400">You can refine all of this anytime from Tools.</p>
      </div>
    </section>
  );
}
