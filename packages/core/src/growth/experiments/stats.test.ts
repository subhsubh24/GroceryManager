/**
 * Unit tests for the A/B experiment statistics (H10). These pure helpers decide whether a growth
 * experiment (paywall copy, onboarding variant, pricing) has a real, significant lift — so a sign
 * error or a divide-by-zero here would silently ship the wrong variant or fabricate significance.
 * They shipped with no dedicated tests (only the registry exercised them indirectly), leaving the
 * null-guards and the two-tailed p-value math unverified in CI. Everything below is deterministic.
 */
import { describe, expect, it } from "vitest";
import {
  minSampleSizePerArm,
  normalCdf,
  twoProportionZTest,
  wilsonInterval,
} from "./stats.js";

describe("normalCdf", () => {
  it("is 0.5 at the mean and monotonic", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1)).toBeGreaterThan(normalCdf(0));
    expect(normalCdf(-1)).toBeLessThan(normalCdf(0));
  });

  it("matches known standard-normal quantiles within the approximation error", () => {
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3); // 95% two-tailed boundary
    expect(normalCdf(1.645)).toBeCloseTo(0.95, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it("is symmetric: Φ(z) + Φ(-z) = 1", () => {
    for (const z of [0.3, 1.1, 2.4]) {
      expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 6);
    }
  });

  it("saturates to 0/1 for non-finite inputs (no NaN leaks)", () => {
    expect(normalCdf(Infinity)).toBe(1);
    expect(normalCdf(-Infinity)).toBe(0);
    expect(normalCdf(NaN)).toBe(0); // NaN > 0 is false → 0 branch
  });
});

describe("twoProportionZTest", () => {
  it("returns nulls + not-significant when either arm has zero exposures", () => {
    expect(twoProportionZTest(0, 0, 5, 100)).toEqual({ zScore: null, pValue: null, significant: false });
    expect(twoProportionZTest(5, 100, 0, 0)).toEqual({ zScore: null, pValue: null, significant: false });
  });

  it("returns nulls when both arms convert at 0% (pooled variance is zero)", () => {
    expect(twoProportionZTest(0, 100, 0, 100)).toEqual({ zScore: null, pValue: null, significant: false });
  });

  it("finds no significance for nearly-equal rates", () => {
    const r = twoProportionZTest(50, 1000, 52, 1000); // 5.0% vs 5.2%
    expect(r.zScore).not.toBeNull();
    expect(r.significant).toBe(false);
    expect(r.pValue!).toBeGreaterThan(0.05);
  });

  it("flags a large, well-powered lift as significant with a positive z (B beats A)", () => {
    const r = twoProportionZTest(50, 1000, 150, 1000); // 5% vs 15%
    expect(r.significant).toBe(true);
    expect(r.zScore!).toBeGreaterThan(0); // B's rate exceeds A's
    expect(r.pValue!).toBeLessThan(0.05);
  });

  it("produces a negative z when B underperforms A (sign carries direction)", () => {
    const r = twoProportionZTest(150, 1000, 50, 1000); // 15% vs 5%
    expect(r.zScore!).toBeLessThan(0);
    expect(r.significant).toBe(true);
  });

  it("is two-tailed: p-value is symmetric under swapping the arms", () => {
    const ab = twoProportionZTest(50, 1000, 150, 1000);
    const ba = twoProportionZTest(150, 1000, 50, 1000);
    expect(ab.pValue).toBeCloseTo(ba.pValue!, 6);
    expect(ab.zScore).toBeCloseTo(-ba.zScore!, 6);
  });

  it("rounds the reported z-score and p-value to 6 decimals", () => {
    const r = twoProportionZTest(50, 1000, 150, 1000);
    expect(r.zScore).toBe(Math.round(r.zScore! * 1e6) / 1e6);
    expect(r.pValue).toBe(Math.round(r.pValue! * 1e6) / 1e6);
  });
});

describe("wilsonInterval", () => {
  it("returns null for a zero or invalid total", () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    expect(wilsonInterval(1, Infinity)).toBeNull();
    expect(wilsonInterval(NaN, 100)).toBeNull();
  });

  it("brackets the point estimate and stays within [0,1]", () => {
    const ci = wilsonInterval(50, 1000)!; // p = 0.05
    expect(ci.lower).toBeGreaterThanOrEqual(0);
    expect(ci.upper).toBeLessThanOrEqual(1);
    expect(ci.lower).toBeLessThan(0.05);
    expect(ci.upper).toBeGreaterThan(0.05);
  });

  it("clamps to [0,1] at the extremes (p=0 and p=1)", () => {
    const lo = wilsonInterval(0, 100)!;
    expect(lo.lower).toBe(0);
    const hi = wilsonInterval(100, 100)!;
    expect(hi.upper).toBe(1);
  });

  it("narrows as the sample grows (more data → tighter interval)", () => {
    const small = wilsonInterval(5, 100)!;
    const large = wilsonInterval(500, 10000)!; // same 5% rate, 100× the data
    expect(large.upper - large.lower).toBeLessThan(small.upper - small.lower);
  });

  it("widens for a higher z (99% CI is wider than 95%)", () => {
    const ci95 = wilsonInterval(50, 1000, 1.96)!;
    const ci99 = wilsonInterval(50, 1000, 2.576)!;
    expect(ci99.upper - ci99.lower).toBeGreaterThan(ci95.upper - ci95.lower);
  });
});

describe("minSampleSizePerArm", () => {
  it("returns 1 for degenerate inputs (no detectable effect or invalid baseline)", () => {
    expect(minSampleSizePerArm(0.05, 0)).toBe(1); // mde = 0
    expect(minSampleSizePerArm(0, 0.02)).toBe(1); // baseline 0
    expect(minSampleSizePerArm(1, 0.02)).toBe(1); // baseline 1
    expect(minSampleSizePerArm(0.99, 0.02)).toBe(1); // baseline + mde ≥ 1
  });

  it("requires a large sample to detect a small lift on a low baseline", () => {
    // 5% baseline, detect +1pp at 95%/80% → thousands per arm.
    const n = minSampleSizePerArm(0.05, 0.01);
    expect(n).toBeGreaterThan(1000);
  });

  it("needs fewer samples for a bigger effect (monotonic in the MDE)", () => {
    const small = minSampleSizePerArm(0.05, 0.01);
    const big = minSampleSizePerArm(0.05, 0.05);
    expect(big).toBeLessThan(small);
  });

  it("returns an integer (ceil) and at least 1", () => {
    const n = minSampleSizePerArm(0.1, 0.02);
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(1);
  });

  it("exercises the rational-approximation path for a non-tabulated alpha/power", () => {
    // alpha/2 = 0.015 and 1-power = 0.15 are not in the lookup table → zFromAlpha approximates.
    const n = minSampleSizePerArm(0.05, 0.02, 0.03, 0.85);
    expect(Number.isFinite(n)).toBe(true);
    expect(n).toBeGreaterThan(1);
  });
});
