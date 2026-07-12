/**
 * Generic runner over a {@link MarginWorkflowEval}. For each case it attributes the workflow (so the
 * shared meter tags every LLM call with the right `workflowId`), runs the real metered path, grades
 * with the genuine grader, and emits the graded outcome (unless the app path already does). A case
 * that throws (not a transient rate-limit) is recorded as a failed outcome rather than aborting the
 * batch — a failure to produce usable output IS a (failed) outcome.
 */
import type { GeminiClient } from "../../../client.js";
import type { EvalScore } from "../../harness.js";
import { isRateLimitError } from "../../harness.js";
import { pickRepresentative } from "../run.js";
import { emitEvalOutcome, type MarginWorkflowEval, type WorkflowCaseResult } from "./types.js";

export interface RunWorkflowOptions {
  /** Cost cap: run at most this many cases (a representative spread across the matrix). */
  maxCases?: number;
  /** Progress hook. */
  onResult?: (r: WorkflowCaseResult, index: number, total: number) => void;
  /** Emit graded outcomes to Margin (default true). Set false for a dry, no-emit check. */
  emit?: boolean;
}

export async function runWorkflowEval<C, O>(
  def: MarginWorkflowEval<C, O>,
  client: GeminiClient,
  opts: RunWorkflowOptions = {},
): Promise<WorkflowCaseResult[]> {
  const cases = opts.maxCases ? pickRepresentative(def.cases, opts.maxCases) : def.cases;
  const prevWorkflow = process.env.MARGIN_WORKFLOW_ID;
  process.env.MARGIN_WORKFLOW_ID = def.workflowId; // attribute this workflow's metered LLM calls
  const out: WorkflowCaseResult[] = [];
  try {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i]!;
      let score: EvalScore;
      try {
        const output = await def.run(c.input, client);
        score = def.grade(output, c.input);
      } catch (e) {
        if (isRateLimitError(e)) throw e; // let the suite skip on infra blips (not a quality signal)
        score = { score: 0, ok: false, detail: [`run threw: ${e instanceof Error ? e.message : String(e)}`] };
      }
      if ((opts.emit ?? true) && !def.appEmitsOutcome) {
        await emitEvalOutcome(def.workflowId, score.ok, score.score);
      }
      const r: WorkflowCaseResult = { workflow: def.workflowId, result: { name: c.name, score } };
      out.push(r);
      opts.onResult?.(r, i, cases.length);
    }
  } finally {
    if (prevWorkflow === undefined) delete process.env.MARGIN_WORKFLOW_ID;
    else process.env.MARGIN_WORKFLOW_ID = prevWorkflow;
  }
  return out;
}
