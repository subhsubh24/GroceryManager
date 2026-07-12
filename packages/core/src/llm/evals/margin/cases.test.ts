/**
 * DETERMINISTIC, CI-SAFE guard for the Margin plan-week eval matrix (runs in the normal gate — NO
 * Gemini, no network). It (1) asserts the matrix stays real + varied so it can't silently shrink or
 * homogenize, and (2) runs every case through the eval scaffold on the DETERMINISTIC fallback path
 * and grades it with the REAL `evaluateWeekPlan`, proving the runner + grader + cases integrate
 * end-to-end. The LIVE model economics are measured separately by `plan-week.eval.test.ts` (gated).
 */
import { describe, expect, it } from "vitest";
import { PLAN_WEEK_EVAL_CASES, PLAN_WEEK_EVAL_CASE_COUNT } from "./cases.js";
import { pickRepresentative, runPlanWeekEvals, sourceCounts, toEvalCaseResult } from "./run.js";
import { aggregate } from "../harness.js";

describe("margin plan-week eval matrix (shape + variety)", () => {
  it("has a substantial, honestly-sized matrix (40..80 real cases)", () => {
    expect(PLAN_WEEK_EVAL_CASE_COUNT).toBe(PLAN_WEEK_EVAL_CASES.length);
    expect(PLAN_WEEK_EVAL_CASE_COUNT).toBeGreaterThanOrEqual(40);
    expect(PLAN_WEEK_EVAL_CASE_COUNT).toBeLessThanOrEqual(80);
  });

  it("has unique case names and well-formed inputs", () => {
    const names = PLAN_WEEK_EVAL_CASES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const c of PLAN_WEEK_EVAL_CASES) {
      expect(c.input.candidates.length).toBeGreaterThan(0);
      expect(c.input.targetDinners ?? 5).toBeGreaterThan(0);
      // Candidate ids are unique within a case (the grader treats a repeat as a hard variety fail).
      const ids = c.input.candidates.map((k) => k.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const cand of c.input.candidates) {
        expect(cand.coverage).toBeGreaterThanOrEqual(0);
        expect(cand.coverage).toBeLessThanOrEqual(1);
      }
    }
  });

  it("spans genuine variety: diets, allergens, budgets, household sizes, and the hard tail", () => {
    const tags = new Set(PLAN_WEEK_EVAL_CASES.flatMap((c) => c.tags));
    for (const t of ["vegan", "vegetarian", "pescatarian", "gluten-free", "keto"]) expect(tags).toContain(t);
    for (const t of ["allergen-nuts", "allergen-shellfish", "allergen-dairy"]) expect(tags).toContain(t);
    for (const t of ["sparse", "expiring-heavy", "conflicting", "low-energy", "budget-tight"]) expect(tags).toContain(t);

    // Hard cases must be a real share of the matrix, not a token one or two.
    const hard = PLAN_WEEK_EVAL_CASES.filter((c) => c.tags.includes("hard"));
    expect(hard.length).toBeGreaterThanOrEqual(8);

    // Household sizes span single → large (via target dinner counts).
    const targets = PLAN_WEEK_EVAL_CASES.map((c) => c.input.targetDinners ?? 5);
    expect(Math.min(...targets)).toBeLessThanOrEqual(2);
    expect(Math.max(...targets)).toBeGreaterThanOrEqual(7);

    // Some cases carry expiring items and some carry a budget — the two economics-relevant levers.
    expect(PLAN_WEEK_EVAL_CASES.some((c) => c.input.expiringNames.length > 0)).toBe(true);
    expect(PLAN_WEEK_EVAL_CASES.some((c) => c.input.budgetCents != null)).toBe(true);
  });

  it("pickRepresentative spreads a cost cap across the whole matrix (not just the first N)", () => {
    const pick = pickRepresentative(PLAN_WEEK_EVAL_CASES, 8);
    expect(pick).toHaveLength(8);
    // Spans from near the front to near the back of the ordered matrix.
    const idx = pick.map((p) => PLAN_WEEK_EVAL_CASES.indexOf(p));
    expect(Math.min(...idx)).toBeLessThan(PLAN_WEEK_EVAL_CASE_COUNT / 4);
    expect(Math.max(...idx)).toBeGreaterThan((3 * PLAN_WEEK_EVAL_CASE_COUNT) / 4);
    // A cap ≥ the matrix (or ≤ 0) is a no-op: run everything.
    expect(pickRepresentative(PLAN_WEEK_EVAL_CASES, 999)).toHaveLength(PLAN_WEEK_EVAL_CASE_COUNT);
    expect(pickRepresentative(PLAN_WEEK_EVAL_CASES, 0)).toHaveLength(PLAN_WEEK_EVAL_CASE_COUNT);
  });
});

describe("margin plan-week eval scaffold (deterministic fallback path — no Gemini)", () => {
  it("grades every case end-to-end via the real evaluator without a model", async () => {
    // No generator => planWeek uses the deterministic fallback; we still get a genuine graded outcome
    // for every case, proving runner + evaluateWeekPlan + cases wire together with zero network.
    const results = await runPlanWeekEvals(); // makeGenerator omitted
    expect(results).toHaveLength(PLAN_WEEK_EVAL_CASE_COUNT);

    for (const r of results) {
      expect(r.source).toBe("fallback");
      expect(r.evaluation.score).toBeGreaterThanOrEqual(0);
      expect(r.evaluation.score).toBeLessThanOrEqual(1);
      expect(typeof r.evaluation.ok).toBe("boolean");
    }

    // The fallback is the deterministic FLOOR — it must clear the rubric on most cases (the LLM only
    // has to beat this floor). A high fallback pass rate also proves the candidate pools are coherent.
    const report = aggregate(results.map(toEvalCaseResult));
    expect(report.passRate).toBeGreaterThanOrEqual(0.7);
    expect(sourceCounts(results)).toEqual({ llm: 0, fallback: PLAN_WEEK_EVAL_CASE_COUNT });
  });

  it("honors a cost cap while still covering the matrix", async () => {
    const results = await runPlanWeekEvals({ maxCases: 6 });
    expect(results).toHaveLength(6);
  });
});
