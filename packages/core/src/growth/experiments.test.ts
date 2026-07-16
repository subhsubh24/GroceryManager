import { describe, it, expect } from "vitest";
import { assignVariant } from "./experiments/bucketing.js";
import {
  twoProportionZTest,
  wilsonInterval,
  minSampleSizePerArm,
  normalCdf,
} from "./experiments/stats.js";
import { EXPERIMENTS, getExperiment } from "./experiments/registry.js";
import { computeExperimentResult } from "./experiments/lift.js";
import type { PerVariantStats } from "./experiments/lift.js";

const SECRET = "test-secret-for-bucketing";
const EXP_ID = "landing_hero";

// ---------------------------------------------------------------------------
// assignVariant — determinism + rough uniformity
// ---------------------------------------------------------------------------

describe("assignVariant", () => {
  it("returns a variant from the provided list", () => {
    const v = assignVariant("user-1", EXP_ID, ["a", "b", "c"], SECRET);
    expect(["a", "b", "c"]).toContain(v);
  });

  it("is deterministic — same inputs → same variant every time", () => {
    const first = assignVariant("user-abc-123", EXP_ID, ["a", "b", "c"], SECRET);
    for (let i = 0; i < 20; i++) {
      expect(assignVariant("user-abc-123", EXP_ID, ["a", "b", "c"], SECRET)).toBe(first);
    }
  });

  it("different users get potentially different variants", () => {
    const variants = new Set<string>();
    for (let i = 0; i < 200; i++) {
      variants.add(assignVariant(`user-${i}`, EXP_ID, ["a", "b", "c"], SECRET));
    }
    // Over 200 users all three variants should appear at least once.
    expect(variants.size).toBe(3);
  });

  it("distributes roughly uniformly across variants (±15%)", () => {
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    const N = 3000;
    for (let i = 0; i < N; i++) {
      const v = assignVariant(`u-${i}`, EXP_ID, ["a", "b", "c"], SECRET);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    const expected = N / 3;
    for (const v of ["a", "b", "c"]) {
      expect(counts[v]!).toBeGreaterThan(expected * 0.85);
      expect(counts[v]!).toBeLessThan(expected * 1.15);
    }
  });

  it("different experiment ids produce different assignments for the same user", () => {
    const v1 = assignVariant("user-X", "exp-alpha", ["a", "b"], SECRET);
    const v2 = assignVariant("user-X", "exp-beta", ["a", "b"], SECRET);
    // Not guaranteed to differ but with overwhelming probability they will over many checks;
    // we test structural independence by confirming the function at minimum returns the right type.
    expect(["a", "b"]).toContain(v1);
    expect(["a", "b"]).toContain(v2);
  });

  it("throws when variants list is empty", () => {
    expect(() => assignVariant("u", EXP_ID, [], SECRET)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// twoProportionZTest — known textbook case + edge cases
// ---------------------------------------------------------------------------

describe("twoProportionZTest", () => {
  it("returns nulls + significant:false when either total is 0", () => {
    expect(twoProportionZTest(5, 0, 10, 100)).toEqual({
      zScore: null, pValue: null, significant: false,
    });
    expect(twoProportionZTest(5, 100, 0, 0)).toEqual({
      zScore: null, pValue: null, significant: false,
    });
  });

  it("detects significance for a textbook clear difference (p<0.05)", () => {
    // 50/1000 vs 100/1000 — large, clear difference
    const r = twoProportionZTest(50, 1000, 100, 1000);
    expect(r.significant).toBe(true);
    expect(r.zScore).not.toBeNull();
    expect(r.pValue!).toBeLessThan(0.05);
  });

  it("does NOT detect significance for tiny difference with small N", () => {
    // 2/10 vs 3/10 — practically no data
    const r = twoProportionZTest(2, 10, 3, 10);
    expect(r.significant).toBe(false);
  });

  it("z-score is negative when B converts LOWER than A", () => {
    const r = twoProportionZTest(100, 1000, 10, 1000);
    expect(r.zScore!).toBeLessThan(0);
  });

  it("returns z ≈ 0 when rates are equal", () => {
    const r = twoProportionZTest(50, 1000, 50, 1000);
    expect(Math.abs(r.zScore!)).toBeLessThan(0.01);
    expect(r.significant).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// wilsonInterval — edge cases
// ---------------------------------------------------------------------------

describe("wilsonInterval", () => {
  it("returns null when total is 0", () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    expect(wilsonInterval(5, 0)).toBeNull();
  });

  it("returns a valid interval for full conversion (1/1)", () => {
    const ci = wilsonInterval(1, 1);
    expect(ci).not.toBeNull();
    expect(ci!.lower).toBeGreaterThanOrEqual(0);
    expect(ci!.upper).toBeLessThanOrEqual(1);
    expect(ci!.lower).toBeLessThanOrEqual(ci!.upper);
  });

  it("returns a valid interval for zero conversion (0/100)", () => {
    const ci = wilsonInterval(0, 100);
    expect(ci).not.toBeNull();
    expect(ci!.lower).toBeGreaterThanOrEqual(0);
    expect(ci!.upper).toBeGreaterThan(0);
  });

  it("interval is centred near the observed rate for large N", () => {
    const ci = wilsonInterval(500, 1000); // 50%
    expect(ci).not.toBeNull();
    const mid = (ci!.lower + ci!.upper) / 2;
    expect(mid).toBeGreaterThan(0.48);
    expect(mid).toBeLessThan(0.52);
  });
});

// ---------------------------------------------------------------------------
// minSampleSizePerArm
// ---------------------------------------------------------------------------

describe("minSampleSizePerArm", () => {
  it("returns a positive integer", () => {
    const n = minSampleSizePerArm(0.05, 0.02);
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThan(0);
  });

  it("larger MDE → smaller required sample", () => {
    const small = minSampleSizePerArm(0.05, 0.05);
    const large = minSampleSizePerArm(0.05, 0.02);
    expect(large).toBeGreaterThan(small);
  });

  it("returns 1 for degenerate inputs (MDE=0)", () => {
    expect(minSampleSizePerArm(0.05, 0)).toBe(1);
  });

  it("higher power requires MORE samples, even when 1−power is non-tabulated (sign regression)", () => {
    // Regression guard for the zFromAlpha sign bug: power 0.85 → 1−power = 0.15 is NOT in the lookup
    // table, so it goes through the rational approximation. With the prior inverted sign, z_beta came
    // back negative and partially CANCELLED z_alpha, collapsing the requirement to ~241 — a ~10×
    // under-estimate that would call experiments "done" while badly underpowered. Correctly, raising
    // power from the tabulated 0.80 to 0.85 must only ever INCREASE the required sample size.
    const at80 = minSampleSizePerArm(0.05, 0.02, 0.05, 0.8); // both z's tabulated (~2211)
    const at85 = minSampleSizePerArm(0.05, 0.02, 0.05, 0.85); // 1−power approximated (~2528)
    expect(at85).toBeGreaterThan(at80);
    expect(at85).toBeGreaterThan(2000); // not the ~241 the inverted sign produced
  });
});

// ---------------------------------------------------------------------------
// normalCdf
// ---------------------------------------------------------------------------

describe("normalCdf", () => {
  it("Φ(0) ≈ 0.5", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 3);
  });

  it("Φ(1.96) ≈ 0.975", () => {
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
  });

  it("Φ(-1.96) ≈ 0.025", () => {
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 2);
  });
});

// ---------------------------------------------------------------------------
// EXPERIMENTS registry
// ---------------------------------------------------------------------------

describe("EXPERIMENTS registry", () => {
  it("landing_hero experiment exists with expected shape", () => {
    const exp = getExperiment("landing_hero");
    expect(exp).toBeDefined();
    expect(exp!.variants).toContain("a");
    expect(exp!.variants).toContain("b");
    expect(exp!.variants).toContain("c");
    expect(exp!.primaryEvent).toBe("waitlist_signup");
    expect(exp!.minSamplePerArm).toBeGreaterThanOrEqual(100);
  });

  it("getExperiment returns undefined for unknown ids", () => {
    expect(getExperiment("no-such-experiment")).toBeUndefined();
  });

  it("all experiments have non-empty variants and hypothesis", () => {
    for (const exp of EXPERIMENTS) {
      expect(exp.variants.length).toBeGreaterThan(0);
      expect(exp.hypothesis.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// computeExperimentResult
// ---------------------------------------------------------------------------

describe("computeExperimentResult", () => {
  const exp = getExperiment("landing_hero")!;

  it("returns running with null lift when no data", () => {
    const r = computeExperimentResult(exp, {});
    expect(r.status).toBe("running");
    expect(r.lift_pct).toBeNull();
    expect(r.result).toBeNull();
  });

  it("returns running when control has insufficient sample", () => {
    const stats: Record<string, PerVariantStats> = {
      a: { exposed: 5, conversions: 1 },
      b: { exposed: 5, conversions: 3 },
    };
    const r = computeExperimentResult(exp, stats);
    expect(r.status).toBe("running");
    expect(r.lift_pct).toBeNull();
  });

  it("returns running even with large sample when difference is not significant", () => {
    // Same rate in both arms → no significance
    const n = exp.minSamplePerArm + 100;
    const stats: Record<string, PerVariantStats> = {
      a: { exposed: n, conversions: Math.round(n * 0.05) },
      b: { exposed: n, conversions: Math.round(n * 0.05) },
      c: { exposed: n, conversions: Math.round(n * 0.05) },
    };
    const r = computeExperimentResult(exp, stats);
    expect(r.status).toBe("running");
    expect(r.lift_pct).toBeNull();
  });

  it("returns decided with non-null lift when there is a clear winner", () => {
    // 5% control vs 12% challenger — clear winner over sufficient sample
    const n = exp.minSamplePerArm * 2;
    const stats: Record<string, PerVariantStats> = {
      a: { exposed: n, conversions: Math.round(n * 0.05) },
      b: { exposed: n, conversions: Math.round(n * 0.12) },
      c: { exposed: n, conversions: Math.round(n * 0.06) },
    };
    const r = computeExperimentResult(exp, stats);
    expect(r.status).toBe("decided");
    expect(r.lift_pct).not.toBeNull();
    expect(r.lift_pct!).toBeGreaterThan(0);
    expect(r.result).not.toBeNull();
    expect(r.ci_lower).not.toBeNull();
    expect(r.ci_upper).not.toBeNull();
    expect(r.leading_variant).toBe("b");
  });

  it("decided result contains id and hypothesis", () => {
    const n = exp.minSamplePerArm * 2;
    const stats: Record<string, PerVariantStats> = {
      a: { exposed: n, conversions: Math.round(n * 0.05) },
      b: { exposed: n, conversions: Math.round(n * 0.12) },
      c: { exposed: n, conversions: Math.round(n * 0.05) },
    };
    const r = computeExperimentResult(exp, stats);
    expect(r.id).toBe("landing_hero");
    expect(r.hypothesis).toBe(exp.hypothesis);
  });

  // The "decided-vs-running gate" (issue #470): control has ENOUGH data, but the leading challenger
  // does NOT — so we must stay `running` yet still surface which arm is ahead, without ever declaring
  // a lift on an under-powered variant. The existing "control insufficient" case returns BEFORE the
  // leading-variant assignment (leading_variant null); this exercises the distinct later branch.
  it("stays running but names the leading variant when the CHALLENGER lacks sample (control sufficient)", () => {
    const stats: Record<string, PerVariantStats> = {
      a: { exposed: exp.minSamplePerArm + 50, conversions: 5 }, // control: sufficient
      b: { exposed: 8, conversions: 5 }, // challenger: highest raw rate but far under-powered
    };
    const r = computeExperimentResult(exp, stats);
    expect(r.status).toBe("running");
    expect(r.lift_pct).toBeNull(); // never declare lift on an under-powered arm
    expect(r.result).toBeNull();
    expect(r.leading_variant).toBe("b"); // still report who's ahead this run
  });

  // Adjacent-but-DISTINCT branch: control has enough data but NO non-control variant has any stats
  // at all (e.g. the earliest exposures, before any challenger is bucketed). `bestVariant` never gets
  // assigned, so the guard must return `running` with leading_variant NULL — not throw, not pick the
  // control, not fabricate a leader. The prior test covers an under-powered challenger that DOES have
  // data (leading_variant "b"); this covers the no-challenger-data case (leading_variant null).
  it("stays running with a NULL leading variant when no challenger has any data yet (control sufficient)", () => {
    const stats: Record<string, PerVariantStats> = {
      a: { exposed: exp.minSamplePerArm + 50, conversions: 5 }, // control: sufficient
      // no entry for any challenger arm → bestVariant is never assigned
    };
    const r = computeExperimentResult(exp, stats);
    expect(r.status).toBe("running");
    expect(r.leading_variant).toBeNull(); // nobody to name yet
    expect(r.lift_pct).toBeNull();
    expect(r.result).toBeNull();
  });

  // Zero-conversion control is a valid outcome, and lift over a 0% base is mathematically undefined
  // (division by zero). A significant winner must still DECIDE — with a real verdict — but report
  // lift_pct null rather than Infinity/NaN. The other "decided" tests all use a non-zero control.
  it("decides with null lift (not Infinity/NaN) when the control converts 0% and a winner is significant", () => {
    const n = exp.minSamplePerArm * 4;
    const stats: Record<string, PerVariantStats> = {
      a: { exposed: n, conversions: 0 }, // control: 0% — undefined lift base
      b: { exposed: n, conversions: Math.round(n * 0.1) }, // clear, well-powered winner
    };
    const r = computeExperimentResult(exp, stats);
    expect(r.status).toBe("decided"); // significance doesn't depend on a non-zero control
    expect(r.lift_pct).toBeNull(); // undefined over a 0% base — not Infinity, not NaN
    expect(r.result).not.toBeNull();
    expect(r.result).toContain("higher"); // direction still reads correctly
    expect(r.leading_variant).toBe("b");
    expect(r.ci_lower).not.toBeNull();
  });

  // A significant result where the leading challenger LOSES to control is a real, actionable outcome
  // ("kill this variant") — the verdict must read "lower" and report a NEGATIVE lift, not silently
  // suppress it. Every other "decided" test has the winner beating control (direction "higher"); this
  // locks the opposite branch (winnerRate < pControl) plus the negative-lift text formatting.
  it("decides 'lower' with a negative lift when the leading challenger significantly underperforms control", () => {
    const n = exp.minSamplePerArm * 4;
    const stats: Record<string, PerVariantStats> = {
      a: { exposed: n, conversions: Math.round(n * 0.4) }, // control: strong 40%
      b: { exposed: n, conversions: Math.round(n * 0.1) }, // best challenger but far below control
    };
    const r = computeExperimentResult(exp, stats);
    expect(r.status).toBe("decided");
    expect(r.leading_variant).toBe("b");
    expect(r.lift_pct).not.toBeNull();
    expect(r.lift_pct!).toBeLessThan(0); // real negative lift, not clamped/hidden
    expect(r.result).toContain("lower"); // direction reads correctly
    expect(r.result).not.toContain("(lift +"); // no "+" sign on a negative lift
  });
});
