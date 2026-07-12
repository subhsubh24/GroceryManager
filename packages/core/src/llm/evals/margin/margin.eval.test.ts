/**
 * UNIFIED LIVE Margin cost-per-outcome runner (real Gemini + real Margin ingest) across ALL covered
 * workflows, or a selected subset. GATED behind RUN_EVALS=1 (+ a Gemini key) so it NEVER runs in the
 * CI / vitest gate lane. For each selected workflow it drives the REAL metered path (emitting a
 * `recordCall` per LLM call, attributed to that workflow) and the GENUINE grader, then emits the graded
 * `recordOutcome` — so a run populates Margin's cost-per-outcome for every covered workflow. The batch
 * is tagged `sessionId="eval:<runId>"`. Fail-safe: no ingest key ⇒ emits no-op; no Gemini key ⇒ skips.
 *
 * Run (from repo root):
 *   RUN_EVALS=1 GEMINI_API_KEY=<key> DATABASE_URL=postgres://x/x \
 *   MARGIN_INGEST_URL=<url> MARGIN_INGEST_KEY=<key> \
 *   pnpm --filter @gm/core eval:margin
 *
 * Overrides: MARGIN_EVAL_WORKFLOW=all | <name,...> (default all — e.g. "receipt-extraction,plan-week"),
 *   MARGIN_EVAL_MAX_CASES=<n> per-workflow cost cap (default 8), MARGIN_EVAL_TIER (plan-week start tier),
 *   MARGIN_EVAL_RUN_ID (default timestamp), MARGIN_EVAL_DRAIN_MS (default 5000).
 */
import { describe, expect, it } from "vitest";
import { GeminiClient } from "../../client.js";
import { aggregate, formatReport, isRateLimitError } from "../harness.js";
import { selectWorkflows } from "./workflows/registry.js";
import { runWorkflowEval } from "./workflows/runner.js";

const RUN = process.env.RUN_EVALS === "1";
const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_VERTEX_PROJECT);

// loadEnv() requires a parseable DATABASE_URL, but these tasks never touch the DB — supply a dummy.
process.env.DATABASE_URL ||= "postgres://eval:eval@localhost:5432/eval";

const runId = process.env.MARGIN_EVAL_RUN_ID || `${Date.now()}`;
const maxCases = Number(process.env.MARGIN_EVAL_MAX_CASES ?? 8) || 8;
const drainMs = Number(process.env.MARGIN_EVAL_DRAIN_MS ?? 5000) || 5000;
const workflows = selectWorkflows(process.env.MARGIN_EVAL_WORKFLOW);

describe.skipIf(!RUN)("Margin cost-per-outcome (live Gemini + Margin, multi-workflow)", () => {
  it(
    "runs the metered path per workflow and emits real economics",
    async (ctx) => {
      if (!hasGeminiKey) {
        console.warn("[margin-eval] no GEMINI_API_KEY / Vertex — skipping (cannot measure LLM economics).");
        return ctx.skip();
      }

      process.env.MARGIN_SESSION_ID = `eval:${runId}`;
      const client = new GeminiClient();

      try {
        for (const def of workflows) {
          const results = await runWorkflowEval(def, client, {
            maxCases,
            onResult: (r, i, total) =>
              console.log(
                `[${def.name} ${i + 1}/${total}] ${r.result.name}: ok=${r.result.score.ok} score=${r.result.score.score.toFixed(2)}`,
              ),
          });
          const report = aggregate(results.map((r) => r.result));
          console.log(
            formatReport(
              `${def.workflowId} [run=${runId} spend=${def.spend} cases=${results.length}/${def.cases.length}]`,
              report,
            ),
          );
          // Lenient floor per workflow — the emitted economics are the primary artifact, not a pass gate.
          expect(results.length).toBeGreaterThan(0);
          expect(report.passRate).toBeGreaterThanOrEqual(0.5);
        }

        // Let the fail-safe, non-blocking CALL emits (from the last cases) flush before the process exits.
        await new Promise((r) => setTimeout(r, drainMs));
      } catch (e) {
        if (isRateLimitError(e)) return ctx.skip();
        throw e;
      } finally {
        delete process.env.MARGIN_SESSION_ID;
      }
    },
    900_000,
  );
});
