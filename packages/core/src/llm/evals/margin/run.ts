/**
 * Margin cost-per-outcome eval RUNNER for `grocerymanager-plan-week`.
 *
 * Drives each case in the matrix through the REAL metered path (`planWeek` + an injected
 * `PlanGenerator`) and grades the result with the REAL evaluator (`evaluateWeekPlan`). Running the
 * real path is what makes this measure economics: `GeminiClient` emits a metered `recordCall` per LLM
 * call (tokens + latency) and `planWeek` emits a graded `recordOutcome` — both fail-safe + non-blocking
 * via the shared meter — so a live run populates Margin's cost-per-successful-plan for this workflow.
 *
 * This module is pure orchestration (no network of its own, no env reads): the live `.eval.test.ts`
 * supplies the Gemini-backed generator + session tag; the deterministic `cases.test.ts` supplies NO
 * generator (grading the fallback) so the whole scaffold is exercised in CI without a key.
 */
import { planWeek, type PlanGenerator } from "../../../agent/plan-week.js";
import type { PlanEvaluation } from "../../../agent/evaluate.js";
import type { EvalCaseResult } from "../harness.js";
import { PLAN_WEEK_EVAL_CASES, type PlanWeekEvalCase } from "./cases.js";

/** One graded case: which path produced the plan + the genuine evaluator verdict. */
export interface PlanWeekEvalResult {
  name: string;
  /** `"llm"` when the injected generator produced (and the plan verified) it; `"fallback"` otherwise. */
  source: "llm" | "fallback";
  evaluation: PlanEvaluation;
}

export interface RunPlanWeekEvalsOptions {
  /**
   * Factory for the LLM generator (called once per case so a fresh escalation budget is used). Return
   * `undefined` to grade the DETERMINISTIC fallback path (no Gemini) — used by the CI-safe test.
   */
  makeGenerator?: () => PlanGenerator | undefined;
  /** Cases to run (default: the full matrix). */
  cases?: PlanWeekEvalCase[];
  /** Cost cap: run at most this many cases (a representative spread — see {@link pickRepresentative}). */
  maxCases?: number;
  /** Progress hook (e.g. live logging / rate-limit handling). */
  onResult?: (r: PlanWeekEvalResult, index: number, total: number) => void;
}

/**
 * A deterministic, representative subset of `cases` of size `n` — stride sampling across the ordered
 * matrix so a cost-capped run still spans diets, household sizes, and the hard tail (rather than just
 * the first N, which would be all-omnivore).
 */
export function pickRepresentative<T>(cases: T[], n: number): T[] {
  if (n >= cases.length || n <= 0) return cases.slice(0, Math.max(0, n) || cases.length);
  const stride = cases.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(cases[Math.floor(i * stride)]!);
  return out;
}

/** Run the matrix (or a capped representative subset) through the real metered path + genuine grader. */
export async function runPlanWeekEvals(
  opts: RunPlanWeekEvalsOptions = {},
): Promise<PlanWeekEvalResult[]> {
  const all = opts.cases ?? PLAN_WEEK_EVAL_CASES;
  const cases = opts.maxCases ? pickRepresentative(all, opts.maxCases) : all;
  const results: PlanWeekEvalResult[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]!;
    const generate = opts.makeGenerator?.();
    const res = await planWeek(c.input, generate ? { generate } : {});
    const result: PlanWeekEvalResult = { name: c.name, source: res.source, evaluation: res.evaluation };
    results.push(result);
    opts.onResult?.(result, i, cases.length);
  }
  return results;
}

/** Adapt a graded result to the shared harness shape so `aggregate`/`formatReport` can be reused. */
export function toEvalCaseResult(r: PlanWeekEvalResult): EvalCaseResult {
  return {
    name: r.name,
    score: { score: r.evaluation.score, ok: r.evaluation.ok, detail: r.evaluation.failures },
  };
}

/** Count how many plans came from the LLM vs the deterministic fallback (a core economics signal). */
export function sourceCounts(results: PlanWeekEvalResult[]): { llm: number; fallback: number } {
  return {
    llm: results.filter((r) => r.source === "llm").length,
    fallback: results.filter((r) => r.source === "fallback").length,
  };
}
