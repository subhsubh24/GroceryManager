/**
 * LIVE Margin cost-per-outcome eval for `grocerymanager-plan-week` (real Gemini + real Margin ingest).
 *
 * GATED behind RUN_EVALS=1 (+ a Gemini key) so it NEVER runs in the CI / vitest gate lane — no real
 * model spend in CI. On demand it drives the eval matrix through the REAL metered path, which makes
 * `GeminiClient` emit a metered `recordCall` per LLM call and `planWeek` emit a graded `recordOutcome`
 * (both via the shared meter). With MARGIN_INGEST_URL/KEY set, those land in Margin as this workflow's
 * cost-per-successful-plan; the batch is tagged `sessionId="eval:<runId>"` so it's separable from real
 * user traffic. Fail-safe: with no ingest key the emits no-op; with no Gemini key it skips.
 *
 * Run (from repo root):
 *   RUN_EVALS=1 \
 *   GEMINI_API_KEY=<key> DATABASE_URL=postgres://x/x \
 *   MARGIN_INGEST_URL=<url> MARGIN_INGEST_KEY=<key> \
 *   pnpm --filter @gm/core eval:margin
 *
 * Config overrides (all optional):
 *   MARGIN_EVAL_MAX_CASES=<n>   cost cap; representative spread across the matrix (default 10)
 *   MARGIN_EVAL_TIER=cheap|mid|reasoning   starting model tier (default: the prod "mid" wrapper)
 *   MARGIN_EVAL_RUN_ID=<id>     batch id → sessionId "eval:<id>" (default: timestamp)
 *   MARGIN_EVAL_DRAIN_MS=<ms>   post-run wait so in-flight (non-blocking) emits flush (default 5000)
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { GeminiTier } from "@gm/config/constants";
import { GeminiClient } from "../../client.js";
import { geminiPlanGenerator } from "../../../agent/gemini-generator.js";
import type { PlanGenerator } from "../../../agent/plan-week.js";
import { PLAN_WEEK_EVAL_CASES } from "./cases.js";
import { runPlanWeekEvals, sourceCounts, toEvalCaseResult } from "./run.js";
import { aggregate, formatReport, isRateLimitError } from "../harness.js";

const RUN = process.env.RUN_EVALS === "1";
const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_VERTEX_PROJECT);

// loadEnv() requires a parseable DATABASE_URL, but the plan-week task never touches the DB — supply a
// dummy so a live eval doesn't need a real database (mirrors the harness README).
process.env.DATABASE_URL ||= "postgres://eval:eval@localhost:5432/eval";

const runId = process.env.MARGIN_EVAL_RUN_ID || `${Date.now()}`;
const maxCases = Number(process.env.MARGIN_EVAL_MAX_CASES ?? 10) || 10;
const tierOverride = process.env.MARGIN_EVAL_TIER as GeminiTier | undefined;
const drainMs = Number(process.env.MARGIN_EVAL_DRAIN_MS ?? 5000) || 5000;

/** The WeekPlan shape the generator must return (mirrors agent/gemini-generator.ts — kept local so
 *  the eval never has to modify the app path just to vary the starting tier). */
const WeekPlanSchema = z.object({
  narrative: z.string(),
  dinners: z.array(
    z.object({
      recipeId: z.string(),
      day: z.string(),
      title: z.string(),
      reason: z.string(),
      usesExpiring: z.array(z.string()),
    }),
  ),
  addToList: z.array(z.string()),
});

/** A tier-configurable generator on the SAME metered path as prod (client.generateWithVerify). */
function tieredGenerator(client: GeminiClient, tier: GeminiTier): PlanGenerator {
  return async (req) => {
    const { value } = await client.generateWithVerify({
      schema: WeekPlanSchema,
      system: req.system,
      prompt: req.prompt,
      tier,
      verify: req.verify,
      maxAttempts: 3,
    });
    return value;
  };
}

describe.skipIf(!RUN)("grocerymanager-plan-week cost-per-outcome (live Gemini + Margin)", () => {
  it(
    "runs the metered path over the eval matrix and emits real economics",
    async (ctx) => {
      if (!hasGeminiKey) {
        console.warn("[margin-eval] no GEMINI_API_KEY / Vertex — skipping (cannot measure LLM economics).");
        return ctx.skip();
      }

      // Tag the whole batch so its calls are separable from real user traffic in Margin.
      process.env.MARGIN_SESSION_ID = `eval:${runId}`;
      const client = new GeminiClient();
      const makeGenerator = () =>
        tierOverride ? tieredGenerator(client, tierOverride) : geminiPlanGenerator(client);

      try {
        const results = await runPlanWeekEvals({
          makeGenerator,
          maxCases,
          onResult: (r, i, total) =>
            console.log(
              `[margin-eval ${i + 1}/${total}] ${r.name}: source=${r.source} ok=${r.evaluation.ok} score=${r.evaluation.score.toFixed(2)}`,
            ),
        });

        // Let the fail-safe, non-blocking emits (from the LAST cases) flush before the process exits.
        await new Promise((r) => setTimeout(r, drainMs));

        const report = aggregate(results.map(toEvalCaseResult));
        const src = sourceCounts(results);
        console.log(
          formatReport(
            `grocerymanager-plan-week [run=${runId} tier=${tierOverride ?? "mid"} cases=${results.length}/${PLAN_WEEK_EVAL_CASES.length} llm=${src.llm} fallback=${src.fallback}]`,
            report,
          ),
        );

        // The LLM should carry most plans (a high fallback share means the model kept failing the
        // evaluator — a real economics regression). Lenient floor: the report is the primary artifact.
        expect(src.llm).toBeGreaterThan(0);
        expect(report.passRate).toBeGreaterThanOrEqual(0.6);
      } catch (e) {
        if (isRateLimitError(e)) return ctx.skip();
        throw e;
      } finally {
        delete process.env.MARGIN_SESSION_ID;
      }
    },
    600_000,
  );
});
