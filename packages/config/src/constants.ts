/**
 * Pinned, centralized constants. Model IDs live here so the whole app changes in one place
 * (see PLAN §8.1). Gemini cheap-first ladder; Flash-Lite is public preview → Flash is the fallback.
 */

export const GEMINI_MODELS = {
  /** Cheap default: classify, receipt extraction, vision detection, normalization, verifier. */
  cheap: "gemini-2.5-flash-lite",
  /** Mid + stable fallback: retries of failed cheap calls, weekly-plan generation, dense vision. */
  mid: "gemini-2.5-flash",
  /** Reasoning: hard planning, gnarly normalization, plan-evaluator disputes. */
  reasoning: "gemini-2.5-pro",
} as const;

export type GeminiTier = keyof typeof GEMINI_MODELS;

/** Matryoshka-truncated output dim for gemini-embedding-001 (fits pgvector index ≤2000). */
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIM = 1536;

/** Default thinking budgets per tier (see PLAN §8.1). 0 disables thinking (Flash only). */
export const THINKING_BUDGET: Record<GeminiTier, number> = {
  cheap: 512, // Flash-Lite minimum
  mid: 0, // Flash can fully disable for cheapest deterministic calls
  reasoning: -1, // Pro: dynamic (cannot disable)
};

/** Pantry depletion / confidence thresholds (see PLAN §5.5, §6, §5.6). */
export const CONFIDENCE = {
  /** Below this, surface a purchase/line in the Review inbox instead of mutating pantry. */
  reviewInboxThreshold: 0.6,
  /** Below this aggregate pantry confidence, the agent may suggest a vision scan. */
  scanSuggestThreshold: 0.5,
  /** Recipe matching only counts items at/above this on-hand confidence. */
  recipeInStockThreshold: 0.4,
} as const;

/** Reorder engine knobs (see PLAN §7.1). */
export const REORDER = {
  /** Suggest when predicted run-out (minus lead time) is within this many days. */
  horizonDays: 3,
} as const;

/** Replenishment "running low" nudge fires at this fraction of the observed interval (§7.5). */
export const REPLENISH_NUDGE_FRACTION = 0.8;
