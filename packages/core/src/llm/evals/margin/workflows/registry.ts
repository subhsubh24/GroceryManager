/**
 * The registry of Margin cost-per-outcome eval suites. Add a workflow here to include it in run-all
 * and make it selectable by name. COVERAGE.md tracks which workflows are covered vs the frontier.
 */
import type { MarginWorkflowEval } from "./types.js";
import { planWeekEval } from "./plan-week.js";
import { receiptExtractionEval } from "./receipt-extraction.js";
import { recipeImportEval } from "./recipe-import.js";
import { substitutionEval } from "./substitution.js";

/** Every covered workflow. Order = run-all order. */
export const ALL_WORKFLOW_EVALS: MarginWorkflowEval<unknown, unknown>[] = [
  planWeekEval as MarginWorkflowEval<unknown, unknown>,
  receiptExtractionEval as MarginWorkflowEval<unknown, unknown>,
  recipeImportEval as MarginWorkflowEval<unknown, unknown>,
  substitutionEval as MarginWorkflowEval<unknown, unknown>,
];

/**
 * Select workflows to run. `undefined` / "all" ⇒ every suite; otherwise a comma-separated list of
 * workflow `name`s or `workflowId`s (unknown names fall back to all, so a typo never runs nothing).
 */
export function selectWorkflows(spec?: string): MarginWorkflowEval<unknown, unknown>[] {
  if (!spec || spec.trim() === "" || spec.trim() === "all") return ALL_WORKFLOW_EVALS;
  const wanted = new Set(spec.split(",").map((s) => s.trim()).filter(Boolean));
  const sel = ALL_WORKFLOW_EVALS.filter((w) => wanted.has(w.name) || wanted.has(w.workflowId));
  return sel.length ? sel : ALL_WORKFLOW_EVALS;
}
