/**
 * Effort & cleanup estimate (PLAN §7.4). A cheap, deterministic heuristic from ingredient count +
 * instruction text — no LLM/key needed (an LLM pass can refine + cache later). Feeds the
 * low-energy recipe ranking so a "15-min, 3-pan" meal isn't treated as "easy".
 */
import type { CleanupLoad } from "@gm/shared";

export interface EffortInput {
  ingredientCount: number;
  instructions?: string | null;
}

export interface EffortEstimate {
  effortScore: number; // 0..1, lower = easier
  cleanupLoad: CleanupLoad;
  onePan: boolean;
}

const PAN_HINTS = [/one[- ]pan/i, /sheet[- ]pan/i, /one[- ]pot/i, /no[- ]cook/i];
const STEP_VERBS = /\b(bake|fry|saut[eé]|simmer|boil|roast|grill|blend|whisk|marinate|knead|braise|broil)\b/gi;

export function estimateEffort(input: EffortInput): EffortEstimate {
  const instr = input.instructions ?? "";
  const steps = (instr.match(/[.!?]\s/g)?.length ?? 0) + (instr.trim() ? 1 : 0);
  const verbs = instr.match(STEP_VERBS)?.length ?? 0;
  const onePan = PAN_HINTS.some((re) => re.test(instr));

  let raw =
    0.3 * (Math.min(input.ingredientCount, 15) / 15) +
    0.4 * (Math.min(steps, 12) / 12) +
    0.3 * (Math.min(verbs, 8) / 8);
  if (onePan) raw *= 0.7; // one-pan/no-cook → meaningfully less cleanup

  const effortScore = Math.max(0, Math.min(1, raw));
  const cleanupLoad: CleanupLoad = onePan || effortScore < 0.4 ? "low" : effortScore < 0.7 ? "med" : "high";
  return { effortScore, cleanupLoad, onePan };
}
