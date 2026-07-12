/**
 * The generic Margin-eval abstraction: one `MarginWorkflowEval` per AI workflow, so the runner can
 * measure cost-per-outcome for ANY workflow (not just plan-week) uniformly — real metered path in,
 * genuine grade out, economics emitted to Margin. See COVERAGE.md for the workflow frontier.
 */
import type { GeminiClient } from "../../../client.js";
import type { EvalScore, EvalCaseResult } from "../../harness.js";
import { meter } from "../../../meter.js";

/** One named, tagged input for a workflow eval. */
export interface EvalCase<C> {
  name: string;
  tags: string[];
  input: C;
}

/**
 * A cost-per-outcome eval for one AI workflow. `run` drives the REAL metered path (the shared meter
 * emits a `recordCall` per LLM call as a side effect); `grade` is a GENUINE evaluator (reuse the real
 * ones — harness scorers, `evaluateWeekPlan`, etc.). The runner emits the graded `recordOutcome`
 * unless the app path already does (`appEmitsOutcome`, e.g. plan-week emits its own).
 */
export interface MarginWorkflowEval<C = unknown, O = unknown> {
  /** The Margin workflowId this suite measures, e.g. "grocerymanager-receipt-extraction". */
  workflowId: string;
  /** Short CLI/report label, e.g. "receipt-extraction" (used by MARGIN_EVAL_WORKFLOW selection). */
  name: string;
  /** Relative per-invocation LLM spend — for reporting + prioritizing what to meter. */
  spend: "low" | "medium" | "high";
  /** One-line description for reports + COVERAGE.md. */
  about: string;
  cases: EvalCase<C>[];
  /** Run the REAL metered path for one case; returns the model output (or throws). */
  run(input: C, client: GeminiClient): Promise<O>;
  /** GENUINE grader → { score(0..1), ok, detail }. */
  grade(output: O, input: C): EvalScore;
  /** True when the app path ALREADY emits this workflow's `recordOutcome` (plan-week does). */
  appEmitsOutcome?: boolean;
}

/** One graded case tagged with the workflow it came from. */
export interface WorkflowCaseResult {
  workflow: string;
  result: EvalCaseResult;
}

/**
 * Emit one graded outcome to Margin, AWAITED so a short-lived runner (script/CI job) flushes it before
 * the process exits — unlike the app path's fire-and-forget emit, which relies on the serverless
 * `waitUntil`. Fail-safe: telemetry never throws into the runner, and with no ingest key it no-ops.
 */
export async function emitEvalOutcome(workflowId: string, passed: boolean, qualityScore: number): Promise<void> {
  try {
    await meter?.recordOutcome({ workflowId, passed, qualityScore, qualityMethod: "ground_truth" });
  } catch {
    /* telemetry must never break the runner */
  }
}
