/**
 * Plan-my-week rubric evaluator (PLAN §8.6) — the cheap, separate "evaluator" half of the
 * generator/evaluator loop. Pure + testable: it grades a drafted week against a fixed rubric
 * (valid picks, target count, variety, pantry coverage, expiring-first, no invented buys) and
 * returns failures. The generator (Flash) drafts; THIS grades — "the call that wrote it doesn't
 * grade it." Used both as the LLM verify() callback (see plan-week.ts) and as a standalone gate.
 */

export interface WeekPlanDinner {
  /** Must reference a candidate recipe id — the model selects, it never invents. */
  recipeId: string;
  day: string;
  title: string;
  reason: string;
  /** On-hand ingredient names this dinner uses up (display only). */
  usesExpiring: string[];
}

export interface WeekPlan {
  narrative: string;
  dinners: WeekPlanDinner[];
  /** Ingredient names to buy — drawn from the chosen recipes' missing items. */
  addToList: string[];
}

/** A curated candidate the planner may choose from (already matched + ranked, §7.2). */
export interface PlanCandidate {
  id: string;
  title: string;
  coverage: number; // 0..1 of core ingredients on hand
  missing: string[]; // core ingredient names not on hand
  usesExpiring: number; // # of on-hand ingredients that are expiring
  expiringIngredients?: string[]; // their names, when known
  cuisine?: string;
}

export interface PlanEvalContext {
  candidates: PlanCandidate[];
  expiringNames: string[];
  targetDinners: number;
}

export interface PlanEvaluation {
  ok: boolean;
  score: number; // 0..1
  failures: string[]; // human-readable rubric failures (also fed back to the generator)
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Grade a drafted plan against the rubric. Hard failures (validity/variety/count) force ok=false. */
export function evaluateWeekPlan(plan: WeekPlan, ctx: PlanEvalContext): PlanEvaluation {
  const failures: string[] = [];
  const byId = new Map(ctx.candidates.map((c) => [c.id, c]));
  const dinners = plan?.dinners ?? [];

  // 1) Validity — every pick must reference a real candidate (hard).
  const invalid = dinners.filter((d) => !byId.has(d.recipeId)).map((d) => d.recipeId);
  if (invalid.length) failures.push(`picked unknown recipe id(s): ${invalid.join(", ")}`);

  // 2) Variety — no repeated recipe (hard).
  const ids = dinners.map((d) => d.recipeId);
  const dups = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dups.length) failures.push(`repeated recipe id(s): ${dups.join(", ")}`);

  // 3) Count — must hit the target, bounded by how many candidates exist (hard).
  const want = Math.min(ctx.targetDinners, ctx.candidates.length);
  if (dinners.length < want) failures.push(`planned ${dinners.length} dinners, need ${want}`);

  const valid = dinners.filter((d) => byId.has(d.recipeId));

  // 4) Coverage — average pantry coverage of the valid picks (soft → score).
  const avgCoverage = valid.length
    ? valid.reduce((s, d) => s + (byId.get(d.recipeId)!.coverage ?? 0), 0) / valid.length
    : 0;

  // 5) Expiring-first — if anything's expiring AND a candidate could use it, the plan should (soft).
  const candidatesCanUseExpiring = ctx.candidates.some((c) => c.usesExpiring > 0);
  const planUsesExpiring = valid.some((d) => (byId.get(d.recipeId)!.usesExpiring ?? 0) > 0);
  const expiringOk =
    !(ctx.expiringNames.length > 0 && candidatesCanUseExpiring) || planUsesExpiring;
  if (!expiringOk) failures.push("expiring items are unused though a candidate could use them");

  // 6) No invented buys — addToList ⊆ union of chosen recipes' missing items (soft).
  const allowed = new Set(valid.flatMap((d) => byId.get(d.recipeId)!.missing));
  const invented = (plan?.addToList ?? []).filter((n) => !allowed.has(n));
  if (invented.length)
    failures.push(`addToList has items missing from no chosen recipe: ${invented.join(", ")}`);

  // 7) Narrative present (soft).
  const hasNarrative = Boolean(plan?.narrative && plan.narrative.trim().length >= 8);
  if (!hasNarrative) failures.push("missing a narrative");

  const score = clamp01(
    0.5 * avgCoverage +
      0.2 * (expiringOk ? 1 : 0) +
      0.15 * (invented.length === 0 ? 1 : 0) +
      0.15 * (hasNarrative ? 1 : 0),
  );

  const hardFail = invalid.length > 0 || dups.length > 0 || dinners.length < want;
  return { ok: !hardFail && score >= 0.6, score, failures };
}
