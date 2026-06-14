/**
 * "Plan my week" agent (PLAN §8.6) — a generator/evaluator over a CURATED candidate set.
 *
 * The harness, not the model, carries reliability: candidates are pre-matched + ranked (§7.2), so
 * the model only *selects, sequences, and narrates* (semantic-layer discipline, §8.2); a cheap
 * separate evaluator grades each draft (evaluate.ts) and the verify-then-escalate loop retries /
 * escalates a tier on failure; and a deterministic fallback guarantees a usable plan even with no
 * API key or a failed LLM call. The LLM is the ceiling; the fallback is the floor.
 */
import {
  evaluateWeekPlan,
  type PlanCandidate,
  type PlanEvalContext,
  type PlanEvaluation,
  type WeekPlan,
} from "./evaluate.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DEFAULT_TARGET = 5;

export interface PlanPrefs {
  diets: string[];
  allergens: string[];
  dislikes: string[];
}

export interface PlanWeekInput {
  candidates: PlanCandidate[];
  expiringNames: string[];
  prefs: PlanPrefs;
  budgetCents: number | null;
  targetDinners?: number;
  lowEnergy?: boolean;
}

export type PlanVerdict = { ok: true } | { ok: false; reason: string };

export interface PlanGenerateRequest {
  system: string;
  prompt: string;
  verify: (plan: WeekPlan) => PlanVerdict;
}

/** The injected LLM step — geminiPlanGenerator in prod, a fake in tests. */
export type PlanGenerator = (req: PlanGenerateRequest) => Promise<WeekPlan>;

export interface PlanWeekResult {
  plan: WeekPlan;
  evaluation: PlanEvaluation;
  source: "llm" | "fallback";
  targetDinners: number;
}

export async function planWeek(
  input: PlanWeekInput,
  deps: { generate?: PlanGenerator } = {},
): Promise<PlanWeekResult> {
  const targetDinners = input.targetDinners ?? DEFAULT_TARGET;
  const ctx: PlanEvalContext = {
    candidates: input.candidates,
    expiringNames: input.expiringNames,
    targetDinners,
  };

  if (deps.generate && input.candidates.length > 0) {
    try {
      const plan = await deps.generate({
        system: planSystemPrompt(),
        prompt: planUserPrompt(input, targetDinners),
        verify: (p) => {
          const ev = evaluateWeekPlan(p, ctx);
          return ev.ok ? { ok: true } : { ok: false, reason: ev.failures.join("; ") };
        },
      });
      return { plan, evaluation: evaluateWeekPlan(plan, ctx), source: "llm", targetDinners };
    } catch {
      // The LLM path is best-effort — drop to the deterministic floor on any failure
      // (no key, expired key, network, or verify-then-escalate exhausted).
    }
  }

  const plan = buildFallbackPlan(input, targetDinners);
  return { plan, evaluation: evaluateWeekPlan(plan, ctx), source: "fallback", targetDinners };
}

/** Deterministic floor: pick the top candidates — expiring-users first, then by coverage. */
export function buildFallbackPlan(input: PlanWeekInput, targetDinners = DEFAULT_TARGET): WeekPlan {
  const ordered = [...input.candidates].sort(
    (a, b) => b.usesExpiring - a.usesExpiring || b.coverage - a.coverage,
  );
  const chosen = ordered.slice(0, Math.min(targetDinners, ordered.length));

  const dinners: WeekPlan["dinners"] = chosen.map((c, i) => ({
    recipeId: c.id,
    day: DAYS[i % DAYS.length]!,
    title: c.title,
    reason:
      c.usesExpiring > 0
        ? `uses ${c.usesExpiring} item(s) that need using up`
        : `you already have ${Math.round(c.coverage * 100)}% of what it needs`,
    usesExpiring: c.expiringIngredients ?? [],
  }));

  const addToList = [...new Set(chosen.flatMap((c) => c.missing))];
  const expiringUsed = chosen.reduce((s, c) => s + c.usesExpiring, 0);
  const narrative =
    chosen.length === 0
      ? "Add a few pantry items and I'll plan your week."
      : `Here's a ${chosen.length}-dinner week built from what you already have${
          expiringUsed > 0 ? ", front-loading what needs using up" : ""
        }. ${
          addToList.length
            ? `You'll need ${addToList.length} item(s) — add them to your list in a tap.`
            : "No shopping needed."
        }`;

  return { narrative, dinners, addToList };
}

// ---- prompt builders (curated context → the generator; §8.3) ----

function planSystemPrompt(): string {
  return [
    "You are a calm, practical weekly dinner planner for a busy household.",
    "Choose dinners ONLY from the provided candidate recipes, referencing each by its exact id.",
    "Never invent recipes or ingredients.",
    "Prioritize recipes that use up expiring ingredients, then those the user already has the most ingredients for.",
    "Respect the user's diet and NEVER choose a recipe that conflicts with a listed allergen.",
    "Assign each dinner a weekday and a one-sentence reason.",
    "addToList must be exactly the union of the missing ingredients of the dinners you chose — nothing else.",
    "Write a short, warm narrative (2-3 sentences). Return JSON only.",
  ].join(" ");
}

function planUserPrompt(input: PlanWeekInput, targetDinners: number): string {
  const lines: string[] = [`Plan ${targetDinners} dinners for the week.`];
  if (input.prefs.diets.length) lines.push(`Diet: ${input.prefs.diets.join(", ")}.`);
  if (input.prefs.allergens.length)
    lines.push(`Allergens to avoid at all costs: ${input.prefs.allergens.join(", ")}.`);
  if (input.prefs.dislikes.length) lines.push(`Disliked: ${input.prefs.dislikes.join(", ")}.`);
  if (input.budgetCents != null)
    lines.push(`Weekly grocery budget: about $${(input.budgetCents / 100).toFixed(0)}.`);
  if (input.lowEnergy) lines.push("Low-energy week — favor quick, low-cleanup dinners.");
  lines.push(
    input.expiringNames.length
      ? `Use up soon: ${input.expiringNames.join(", ")}.`
      : "Nothing is expiring right now.",
  );
  lines.push("", "Candidate recipes (id — title — coverage — expiring — missing):");
  for (const c of input.candidates) {
    lines.push(
      `- ${c.id} — ${c.title} — coverage ${Math.round(c.coverage * 100)}% — expiring ${c.usesExpiring} — missing: ${
        c.missing.join(", ") || "none"
      }${c.cuisine ? ` — cuisine ${c.cuisine}` : ""}`,
    );
  }
  return lines.join("\n");
}
