/**
 * Margin cost-per-outcome eval for PLAN-MY-WEEK (workflow #15) — the flagship metered workflow, here
 * adapted onto the generic runner so run-all covers it too. Reuses the existing input matrix
 * (`cases.ts`), the REAL metered path (`planWeek` + `geminiPlanGenerator`), and the REAL grader
 * (`evaluateWeekPlan`, surfaced as `result.evaluation`). `appEmitsOutcome: true` — `planWeek` emits its
 * own `recordOutcome`, so the generic runner must NOT double-emit.
 */
import { z } from "zod";
import type { GeminiTier } from "@gm/config/constants";
import type { EvalScore } from "../../harness.js";
import { GeminiClient } from "../../../client.js";
import { planWeek, type PlanGenerator, type PlanWeekInput } from "../../../../agent/plan-week.js";
import { geminiPlanGenerator } from "../../../../agent/gemini-generator.js";
import { PLAN_WEEK_EVAL_CASES } from "../cases.js";
import type { EvalCase, MarginWorkflowEval } from "./types.js";

type PlanWeekOutput = Awaited<ReturnType<typeof planWeek>>;

/** Mirror of agent/gemini-generator's WeekPlan schema — kept local so a tier override needs no app change. */
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

const cases: EvalCase<PlanWeekInput>[] = PLAN_WEEK_EVAL_CASES.map((c) => ({
  name: c.name,
  tags: c.tags,
  input: c.input,
}));

export const planWeekEval: MarginWorkflowEval<PlanWeekInput, PlanWeekOutput> = {
  workflowId: "grocerymanager-plan-week",
  name: "plan-week",
  spend: "high",
  about: "Select/sequence/narrate a weekly dinner plan from curated candidates (mid→Pro verify loop).",
  appEmitsOutcome: true, // planWeek emits its own recordOutcome — the runner must not double-emit
  cases,
  async run(input, client): Promise<PlanWeekOutput> {
    const tierOverride = process.env.MARGIN_EVAL_TIER as GeminiTier | undefined;
    const generate = tierOverride ? tieredGenerator(client, tierOverride) : geminiPlanGenerator(client);
    return planWeek(input, { generate });
  },
  grade(output): EvalScore {
    return { score: output.evaluation.score, ok: output.evaluation.ok, detail: output.evaluation.failures };
  },
};
