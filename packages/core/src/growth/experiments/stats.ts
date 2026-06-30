/**
 * H10 — Pure statistical helpers for A/B experiment analysis.
 *
 * All functions are pure + synchronous. They return `null` rather than NaN / Infinity when
 * inputs are insufficient (zero denominators, too-small samples, etc.). "Insufficient data"
 * is represented by nulls + significant:false — never fabricated numbers.
 */

// ---------------------------------------------------------------------------
// Normal CDF helper (Abramowitz & Stegun approximation, max error ~1.5×10⁻⁷)
// ---------------------------------------------------------------------------

/** Cumulative distribution function of the standard normal (Φ). */
export function normalCdf(z: number): number {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t * (0.319381530 +
      t * (-0.356563782 +
        t * (1.781477937 +
          t * (-1.821255978 +
            t * 1.330274429))));
  const base = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? base : 1 - base;
}

// ---------------------------------------------------------------------------
// Two-proportion z-test (two-tailed)
// ---------------------------------------------------------------------------

export interface ZTestResult {
  /** The z-score, or null when inputs are invalid. */
  zScore: number | null;
  /** Two-tailed p-value, or null when the z-score is null. */
  pValue: number | null;
  /** Whether the result is statistically significant at α = 0.05. */
  significant: boolean;
}

/**
 * Two-proportion z-test: is the conversion rate of arm B significantly different from arm A?
 *
 * Returns nulls + significant:false when either total is 0 or a pooled proportion would
 * cause division by zero.
 */
export function twoProportionZTest(
  aConv: number,
  aTotal: number,
  bConv: number,
  bTotal: number,
): ZTestResult {
  if (aTotal <= 0 || bTotal <= 0) {
    return { zScore: null, pValue: null, significant: false };
  }
  const pA = aConv / aTotal;
  const pB = bConv / bTotal;
  const pooled = (aConv + bConv) / (aTotal + bTotal);
  const variance = pooled * (1 - pooled) * (1 / aTotal + 1 / bTotal);
  if (variance <= 0) {
    return { zScore: null, pValue: null, significant: false };
  }
  const z = (pB - pA) / Math.sqrt(variance);
  if (!Number.isFinite(z)) {
    return { zScore: null, pValue: null, significant: false };
  }
  // Two-tailed p-value.
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  return {
    zScore: Math.round(z * 1e6) / 1e6,
    pValue: Math.round(pValue * 1e6) / 1e6,
    significant: pValue < 0.05,
  };
}

// ---------------------------------------------------------------------------
// Wilson score confidence interval
// ---------------------------------------------------------------------------

export interface WilsonInterval {
  lower: number;
  upper: number;
}

/**
 * Wilson score confidence interval for a proportion.
 *
 * Returns null when `total` is 0 or inputs are otherwise invalid.
 * Default z = 1.96 → 95% CI.
 */
export function wilsonInterval(
  conv: number,
  total: number,
  z = 1.96,
): WilsonInterval | null {
  if (total <= 0 || !Number.isFinite(conv) || !Number.isFinite(total)) return null;
  const p = conv / total;
  const z2 = z * z;
  const n = total;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const margin = (z / (1 + z2 / n)) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
  return {
    lower: Math.max(0, Math.round((centre - margin) * 1e6) / 1e6),
    upper: Math.min(1, Math.round((centre + margin) * 1e6) / 1e6),
  };
}

// ---------------------------------------------------------------------------
// Minimum sample size per arm (two-tailed, equal-arm)
// ---------------------------------------------------------------------------

/**
 * Minimum sample size per arm for a two-proportion test.
 *
 * Uses the standard formula: n = (z_α/2 + z_β)² × (p1(1-p1) + p2(1-p2)) / (p2-p1)².
 * Returns at least 1.
 *
 * @param baselineRate  Expected conversion rate for the control arm (0..1).
 * @param mde           Minimum detectable effect (absolute difference, e.g. 0.02 for +2pp).
 * @param alpha         Type-I error rate (default 0.05 → 95% CI).
 * @param power         Desired power (default 0.80 → 80%).
 */
export function minSampleSizePerArm(
  baselineRate: number,
  mde: number,
  alpha = 0.05,
  power = 0.8,
): number {
  if (mde <= 0 || baselineRate <= 0 || baselineRate >= 1) return 1;
  const p2 = baselineRate + mde;
  if (p2 >= 1) return 1;
  // z critical values — use the normal quantile function via a pre-computed table.
  const zAlpha = zFromAlpha(alpha / 2);
  const zBeta = zFromAlpha(1 - power);
  const num = Math.pow(zAlpha + zBeta, 2) * (baselineRate * (1 - baselineRate) + p2 * (1 - p2));
  const denom = Math.pow(mde, 2);
  return Math.max(1, Math.ceil(num / denom));
}

/**
 * Approximate quantile of the standard normal (inverse CDF) for the given cumulative
 * probability `p`. Rational approximation (Abramowitz & Stegun §26.2.17).
 */
function zFromAlpha(p: number): number {
  // Common values (lookup first for precision):
  const table: Record<number, number> = { 0.025: 1.96, 0.05: 1.645, 0.1: 1.282, 0.2: 0.842, 0.5: 0 };
  const rounded = Math.round(p * 1e4) / 1e4;
  if (Object.prototype.hasOwnProperty.call(table, rounded)) return table[rounded]!;

  // Rational approximation: `z` is the POSITIVE upper-tail quantile of min(p, 1-p).
  const q = p <= 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(q));
  const c = [2.515517, 0.802853, 0.010328];
  const d = [1.432788, 0.189269, 0.001308];
  const z = t - (c[0]! + c[1]! * t + c[2]! * t * t) / (1 + d[0]! * t + d[1]! * t * t + d[2]! * t * t * t);
  // Match the table convention (a small upper-tail probability → a POSITIVE critical value, e.g.
  // 0.025 → +1.96): return +z for p ≤ 0.5 and −z for p > 0.5. The prior sign was inverted, which made
  // minSampleSizePerArm under-estimate ~10× whenever exactly one of alpha/power was non-tabulated.
  return p <= 0.5 ? z : -z;
}
