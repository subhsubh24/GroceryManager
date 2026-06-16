import { describe, expect, it } from "vitest";
import {
  evaluateWeekPlan,
  type PlanCandidate,
  type PlanEvalContext,
  type WeekPlan,
} from "./evaluate.js";

const cand = (id: string, over: Partial<PlanCandidate> = {}): PlanCandidate => ({
  id,
  title: `R-${id}`,
  coverage: 0.8,
  missing: [],
  usesExpiring: 0,
  ...over,
});

const dinner = (recipeId: string) => ({
  recipeId,
  day: "Monday",
  title: `R-${recipeId}`,
  reason: "good fit",
  usesExpiring: [],
});

const ctx = (candidates: PlanCandidate[], over: Partial<PlanEvalContext> = {}): PlanEvalContext => ({
  candidates,
  expiringNames: [],
  targetDinners: candidates.length,
  ...over,
});

const plan = (over: Partial<WeekPlan> = {}): WeekPlan => ({
  narrative: "A solid, simple week of dinners.",
  dinners: [],
  addToList: [],
  ...over,
});

describe("evaluateWeekPlan", () => {
  it("passes a clean, fully-valid plan with a high score", () => {
    const c = [cand("a"), cand("b")];
    const ev = evaluateWeekPlan(plan({ dinners: [dinner("a"), dinner("b")] }), ctx(c));
    expect(ev.ok).toBe(true);
    expect(ev.failures).toEqual([]);
    expect(ev.score).toBeGreaterThan(0.8);
  });

  it("hard-fails when a dinner references an unknown recipe id", () => {
    const ev = evaluateWeekPlan(plan({ dinners: [dinner("zzz")] }), ctx([cand("a")]));
    expect(ev.ok).toBe(false);
    expect(ev.failures.join(" ")).toMatch(/unknown recipe id/i);
  });

  it("hard-fails on a repeated recipe (no variety)", () => {
    const c = [cand("a"), cand("b")];
    const ev = evaluateWeekPlan(plan({ dinners: [dinner("a"), dinner("a")] }), ctx(c));
    expect(ev.ok).toBe(false);
    expect(ev.failures.join(" ")).toMatch(/repeated recipe id/i);
  });

  it("hard-fails when fewer dinners than the (candidate-bounded) target", () => {
    const c = [cand("a"), cand("b"), cand("c")];
    const ev = evaluateWeekPlan(plan({ dinners: [dinner("a")] }), ctx(c, { targetDinners: 3 }));
    expect(ev.ok).toBe(false);
    expect(ev.failures.join(" ")).toMatch(/planned 1 dinners, need 3/i);
  });

  it("does not require more dinners than there are candidates", () => {
    const c = [cand("a")];
    const ev = evaluateWeekPlan(plan({ dinners: [dinner("a")] }), ctx(c, { targetDinners: 5 }));
    expect(ev.ok).toBe(true); // want = min(5, 1) = 1
  });

  it("soft-flags (but still allows) a plan that ignores usable expiring items", () => {
    const c = [cand("a", { usesExpiring: 1 }), cand("b")];
    const ev = evaluateWeekPlan(
      plan({ dinners: [dinner("b")] }),
      ctx(c, { expiringNames: ["spinach"], targetDinners: 1 }),
    );
    expect(ev.failures.join(" ")).toMatch(/expiring items are unused/i);
    expect(ev.score).toBeLessThan(0.8); // penalized vs a clean plan
  });

  it("rewards using expiring items over ignoring them", () => {
    const c = [cand("a", { usesExpiring: 1 }), cand("b")];
    const base = ctx(c, { expiringNames: ["spinach"], targetDinners: 1 });
    const used = evaluateWeekPlan(plan({ dinners: [dinner("a")] }), base);
    const ignored = evaluateWeekPlan(plan({ dinners: [dinner("b")] }), base);
    expect(used.score).toBeGreaterThan(ignored.score);
  });

  it("soft-flags addToList items not missing from any chosen recipe", () => {
    const c = [cand("a", { missing: ["garlic"] })];
    const ev = evaluateWeekPlan(
      plan({ dinners: [dinner("a")], addToList: ["garlic", "truffle"] }),
      ctx(c),
    );
    expect(ev.failures.join(" ")).toMatch(/missing from no chosen recipe.*truffle/i);
  });

  it("flags a missing narrative", () => {
    const ev = evaluateWeekPlan(plan({ narrative: "", dinners: [dinner("a")] }), ctx([cand("a")]));
    expect(ev.failures.join(" ")).toMatch(/missing a narrative/i);
  });
});
