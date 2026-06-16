/**
 * Cheap LLM-as-judge (PLAN §8.5) — a Flash-Lite scorer for semantic checks that exact-field
 * matching is too brittle for. "The call that wrote it doesn't grade it": this is a separate call.
 */
import { z } from "zod";
import type { GeminiClient } from "../client.js";

const Judgement = z.object({
  score: z.number(),
  reason: z.string(),
});

export interface Judgement {
  score: number; // clamped to 0..1
  reason: string;
}

export async function llmJudge(
  client: GeminiClient,
  rubric: string,
  payload: string,
): Promise<Judgement> {
  const res = await client.generateStructured(
    Judgement,
    `${rubric}\n\n--- OUTPUT TO JUDGE ---\n${payload}\n--- END ---\n` +
      `Return {"score": 0..1, "reason": "<one line>"}.`,
    { tier: "cheap", system: "You are a strict evaluator. Judge only what is asked. Output JSON only." },
  );
  return { score: Math.max(0, Math.min(1, res.score)), reason: res.reason };
}
