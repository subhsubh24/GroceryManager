/**
 * Wires the GeminiClient (§8) into a PlanGenerator for the plan-my-week agent. Isolated here so
 * plan-week.ts stays free of any @google/genai dependency and is unit-testable with a fake.
 * Generation starts at the "mid" tier (Flash, §8.6) and escalates to Pro only if the evaluator
 * keeps failing — the verify-then-escalate loop lives in generateWithVerify.
 */
import { z } from "zod";
import { getGeminiClient, type GeminiClient } from "../llm/client.js";
import type { PlanGenerator } from "./plan-week.js";

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

export function geminiPlanGenerator(client: GeminiClient = getGeminiClient()): PlanGenerator {
  return async (req) => {
    const { value } = await client.generateWithVerify({
      schema: WeekPlanSchema,
      system: req.system,
      prompt: req.prompt,
      tier: "mid",
      verify: req.verify,
      maxAttempts: 3,
    });
    return value;
  };
}
