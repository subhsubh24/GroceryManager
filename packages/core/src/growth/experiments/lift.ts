/**
 * H10 — Experiment result computation: lift, CI, significance.
 *
 * Pure builder. Compares the best non-control variant vs the control arm, declares a result
 * ONLY when BOTH arms exceed minSamplePerArm AND the test is significant. Otherwise:
 * status "running", lift null, CI null. NEVER fabricates a lift.
 */
import { twoProportionZTest, wilsonInterval } from "./stats.js";
import type { ExperimentDefinition } from "./registry.js";

export interface PerVariantStats {
  exposed: number;
  conversions: number;
}

export interface ExperimentResult {
  id: string;
  hypothesis: string;
  /** "running" → still collecting; "decided" → significant + sufficient data. */
  status: "running" | "decided";
  /** Human-readable verdict (null when running). */
  result: string | null;
  /** Relative lift over control (null when running or no conversion in control). */
  lift_pct: number | null;
  /** Wilson CI lower bound for the winning variant (null when running). */
  ci_lower: number | null;
  /** Wilson CI upper bound for the winning variant (null when running). */
  ci_upper: number | null;
  /** The leading non-control variant for this run (null when no data). */
  leading_variant: string | null;
}

/**
 * Compute the result of an experiment given per-variant exposure + conversion counts.
 *
 * The FIRST variant in `exp.variants` is the control. This compares every non-control arm
 * against the control and selects the one with the highest conversion rate as the "best"
 * challenger. A result is declared only when BOTH the control and the best challenger have
 * ≥ minSamplePerArm exposures AND the z-test is significant (p < 0.05).
 */
export function computeExperimentResult(
  exp: ExperimentDefinition,
  perVariantStats: Record<string, PerVariantStats>,
): ExperimentResult {
  const base: Omit<ExperimentResult, "status" | "result" | "lift_pct" | "ci_lower" | "ci_upper" | "leading_variant"> = {
    id: exp.id,
    hypothesis: exp.hypothesis,
  };
  const running: ExperimentResult = {
    ...base,
    status: "running",
    result: null,
    lift_pct: null,
    ci_lower: null,
    ci_upper: null,
    leading_variant: null,
  };

  const controlVariant = exp.variants[0];
  if (!controlVariant) return running;

  const controlStats = perVariantStats[controlVariant];
  if (!controlStats || controlStats.exposed < exp.minSamplePerArm) return running;

  const pControl = controlStats.exposed > 0 ? controlStats.conversions / controlStats.exposed : 0;

  // Find the non-control variant with the highest raw conversion rate.
  let bestVariant: string | null = null;
  let bestStats: PerVariantStats | null = null;
  let bestRate = -Infinity;

  for (const variant of exp.variants.slice(1)) {
    const s = perVariantStats[variant];
    if (!s) continue;
    const rate = s.exposed > 0 ? s.conversions / s.exposed : 0;
    if (rate > bestRate) {
      bestRate = rate;
      bestVariant = variant;
      bestStats = s;
    }
  }

  if (!bestVariant || !bestStats || bestStats.exposed < exp.minSamplePerArm) {
    return { ...running, leading_variant: bestVariant };
  }

  const test = twoProportionZTest(
    controlStats.conversions,
    controlStats.exposed,
    bestStats.conversions,
    bestStats.exposed,
  );

  if (!test.significant) {
    return { ...running, leading_variant: bestVariant };
  }

  // Significant result — compute lift + CI.
  const winnerRate = bestStats.conversions / bestStats.exposed;
  const liftPct =
    pControl > 0
      ? Math.round(((winnerRate - pControl) / pControl) * 10000) / 100
      : null;

  const ci = wilsonInterval(bestStats.conversions, bestStats.exposed);

  const direction = winnerRate > pControl ? "higher" : "lower";
  const resultText =
    `Variant ${bestVariant} converts ${direction} than control ${controlVariant}` +
    (liftPct != null ? ` (lift ${liftPct > 0 ? "+" : ""}${liftPct.toFixed(1)}%)` : "") +
    `. p = ${test.pValue?.toFixed(4) ?? "n/a"}.`;

  return {
    ...base,
    status: "decided",
    result: resultText,
    lift_pct: liftPct,
    ci_lower: ci?.lower ?? null,
    ci_upper: ci?.upper ?? null,
    leading_variant: bestVariant,
  };
}
