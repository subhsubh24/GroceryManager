/**
 * H10 — Code-defined experiment registry.
 *
 * Experiments are defined here (no admin DB step). Each entry describes the hypothesis,
 * variants, the primary conversion event, and the minimum sample size per arm to declare a
 * winner. The data lives in code so it's versioned alongside the feature and never drifts
 * from what the bucketing/stats layer actually tests.
 */
import { minSampleSizePerArm } from "./stats.js";

export interface ExperimentDefinition {
  /** Stable identifier — matches `experiment_id` in DB tables. */
  id: string;
  /** Falsifiable hypothesis. */
  hypothesis: string;
  /** Ordered variant names. The first is always the control. */
  variants: string[];
  /** Primary Plausible/custom event that counts as a conversion. */
  primaryEvent: string;
  /**
   * Minimum exposures per arm required before we can declare a winner.
   * Below this → status "running", lift null, never fabricated.
   */
  minSamplePerArm: number;
}

/**
 * The deployed experiment registry. Add new experiments here; each is DORMANT (no traffic
 * assigned) until the owner connects a live channel or signs-in users start landing on pages
 * that call `assignAndLogVariant`.
 */
export const EXPERIMENTS: ExperimentDefinition[] = [
  {
    id: "landing_hero",
    hypothesis:
      "Variant B ('Stop guessing at dinner') and C ('Your kitchen, finally in sync') increase " +
      "waitlist signup rate vs the current variant A ('Always know what to cook') by at least 2pp.",
    variants: ["a", "b", "c"],
    primaryEvent: "waitlist_signup",
    // 5% baseline, +2pp MDE, α=0.05, power=0.80 → ~1192 per arm; floor at 100 for early signal.
    minSamplePerArm: Math.max(100, minSampleSizePerArm(0.05, 0.02)),
  },
];

/**
 * Look up an experiment definition by id.
 * Returns `undefined` when the id is unknown — callers should handle missing gracefully.
 */
export function getExperiment(id: string): ExperimentDefinition | undefined {
  return EXPERIMENTS.find((e) => e.id === id);
}
