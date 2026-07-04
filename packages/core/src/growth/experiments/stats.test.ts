import { describe, it, expect } from "vitest";
import {
  normalCdf,
  twoProportionZTest,
  wilsonInterval,
  minSampleSizePerArm,
} from "./stats.js";

/**
 * H10 — the experiment stats helpers are pure + numerically sensitive (normal-CDF approximations,
 * a two-proportion z-test, Wilson CIs, and a sample-size formula that feeds the A/B guardrails).
 * These decide whether a monetization experiment is "decided" vs "still running", so a silent
 * numerical regression would either fabricate significance or hide a real lift. This suite pins the
 * known-good values (textbook Φ, Wilson intervals) AND guards the historical sign bug in the
 * non-tabulated normal-quantile path (see zFromAlpha in stats.ts) via the monotonicity of the
 * sample-size formula.
 */

describe("normalCdf", () => {
  it("is 0.5 at the mean", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
  });

  it("matches textbook Φ at ±1 and ±1.96", () => {
    expect(normalCdf(1)).toBeCloseTo(0.8413, 4);
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 4);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 4);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 4);
  });

  it("saturates at the tails and treats non-finite input as ±∞", () => {
    expect(normalCdf(Infinity)).toBe(1);
    expect(normalCdf(-Infinity)).toBe(0);
    expect(normalCdf(NaN)).toBe(0); // NaN > 0 is false → 0
    expect(normalCdf(40)).toBeCloseTo(1, 6);
    expect(normalCdf(-40)).toBeCloseTo(0, 6);
  });

  it("is symmetric: Φ(z) + Φ(−z) = 1", () => {
    for (const z of [0.25, 0.7, 1.3, 2.4, 3.1]) {
      expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 6);
    }
  });
});

describe("twoProportionZTest", () => {
  it("flags a clear difference as significant with a positive z for B > A", () => {
    const r = twoProportionZTest(10, 100, 30, 100);
    expect(r.significant).toBe(true);
    expect(r.zScore).not.toBeNull();
    expect(r.zScore!).toBeGreaterThan(3);
    expect(r.pValue!).toBeGreaterThan(0);
    expect(r.pValue!).toBeLessThan(0.05);
  });

  it("returns z=0, p=1, not significant for identical proportions", () => {
    const r = twoProportionZTest(50, 100, 50, 100);
    expect(r.zScore).toBe(0);
    expect(r.pValue).toBe(1);
    expect(r.significant).toBe(false);
  });

  it("never claims significance from insufficient / degenerate data (all nulls)", () => {
    // Zero totals.
    expect(twoProportionZTest(5, 0, 5, 10)).toEqual({
      zScore: null,
      pValue: null,
      significant: false,
    });
    expect(twoProportionZTest(5, 10, 5, 0)).toEqual({
      zScore: null,
      pValue: null,
      significant: false,
    });
    // Pooled proportion 0 (no conversions anywhere) → zero variance → nulls, not a divide-by-zero NaN.
    expect(twoProportionZTest(0, 50, 0, 50)).toEqual({
      zScore: null,
      pValue: null,
      significant: false,
    });
    // Pooled proportion 1 (everyone converts) → zero variance → nulls.
    expect(twoProportionZTest(50, 50, 50, 50)).toEqual({
      zScore: null,
      pValue: null,
      significant: false,
    });
  });

  it("rounds z and p to 6 decimals (no float noise leaking to callers)", () => {
    const r = twoProportionZTest(10, 100, 30, 100);
    expect(r.zScore).toBe(3.535534);
    expect(r.pValue).toBe(0.000407);
  });
});

describe("wilsonInterval", () => {
  it("matches the textbook 95% CI for 5/10", () => {
    const ci = wilsonInterval(5, 10);
    expect(ci).not.toBeNull();
    expect(ci!.lower).toBeCloseTo(0.2366, 3);
    expect(ci!.upper).toBeCloseTo(0.7634, 3);
  });

  it("clamps the bounds into [0, 1] at the extremes", () => {
    const all = wilsonInterval(10, 10)!;
    expect(all.upper).toBe(1); // would exceed 1 unclamped
    expect(all.lower).toBeGreaterThan(0);
    const none = wilsonInterval(0, 10)!;
    expect(none.lower).toBe(0); // would go below 0 unclamped
    expect(none.upper).toBeLessThan(1);
  });

  it("returns null for a zero / non-finite denominator", () => {
    expect(wilsonInterval(1, 0)).toBeNull();
    expect(wilsonInterval(0, 0)).toBeNull();
    expect(wilsonInterval(NaN, 10)).toBeNull();
    expect(wilsonInterval(5, Infinity)).toBeNull();
  });

  it("widens as the sample shrinks (more uncertainty)", () => {
    const wide = wilsonInterval(5, 10)!;
    const narrow = wilsonInterval(500, 1000)!;
    expect(wide.upper - wide.lower).toBeGreaterThan(narrow.upper - narrow.lower);
  });
});

describe("minSampleSizePerArm", () => {
  it("computes the standard sample size for a tabulated α/power (0.05 / 0.80)", () => {
    // Baseline 10%, +5pp MDE, 95%/80% → ~684 per arm (matches standard calculators).
    expect(minSampleSizePerArm(0.1, 0.05, 0.05, 0.8)).toBe(684);
  });

  it("requires MORE samples for higher power — the sign-bug regression guard", () => {
    // power 0.85 forces the NON-tabulated quantile path (1 − power = 0.15 is not in the lookup
    // table), exercising zFromAlpha's rational approximation. A prior inverted-sign bug there made
    // this UNDER-estimate ~10×, which would make a higher-power test demand FEWER samples — an
    // impossible, silently-wrong result. Assert strict monotonicity in power to lock the sign.
    const n80 = minSampleSizePerArm(0.1, 0.05, 0.05, 0.8); // 684 (tabulated)
    const n85 = minSampleSizePerArm(0.1, 0.05, 0.05, 0.85); // 782 (approximation path)
    const n90 = minSampleSizePerArm(0.1, 0.05, 0.05, 0.9); // 915 (tabulated)
    expect(n85).toBeGreaterThan(n80);
    expect(n90).toBeGreaterThan(n85);
    expect(n85).toBe(782);
  });

  it("returns 1 for invalid inputs instead of NaN/negative sizes", () => {
    expect(minSampleSizePerArm(0.1, 0)).toBe(1); // zero MDE
    expect(minSampleSizePerArm(0.1, -0.05)).toBe(1); // negative MDE
    expect(minSampleSizePerArm(0, 0.05)).toBe(1); // baseline ≤ 0
    expect(minSampleSizePerArm(1, 0.05)).toBe(1); // baseline ≥ 1
    expect(minSampleSizePerArm(0.99, 0.05)).toBe(1); // baseline + MDE ≥ 1
  });
});
