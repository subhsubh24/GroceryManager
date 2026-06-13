import { GEMINI_MODELS, THINKING_BUDGET, type GeminiTier } from "@gm/config/constants";

/** Cheap → mid → reasoning escalation order (PLAN §8.1). */
export const TIER_ORDER: GeminiTier[] = ["cheap", "mid", "reasoning"];

/**
 * Resolve a tier to a concrete model id. Flash-Lite is public preview — when the
 * `useFlashLite` flag is off we transparently fall back the cheap tier to Flash.
 */
export function resolveModel(tier: GeminiTier, useFlashLite: boolean): string {
  if (tier === "cheap" && !useFlashLite) return GEMINI_MODELS.mid;
  return GEMINI_MODELS[tier];
}

/** The next tier up, or null if already at the top. */
export function nextTier(tier: GeminiTier): GeminiTier | null {
  const i = TIER_ORDER.indexOf(tier);
  return i >= 0 && i < TIER_ORDER.length - 1 ? (TIER_ORDER[i + 1] as GeminiTier) : null;
}

export function thinkingBudgetFor(tier: GeminiTier): number {
  return THINKING_BUDGET[tier];
}
