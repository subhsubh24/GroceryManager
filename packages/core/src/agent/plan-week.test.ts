import { describe, expect, it } from "vitest";
import type { PlanCandidate } from "./evaluate.js";
import { buildFallbackPlan, planWeek, type PlanGenerator, type PlanWeekInput } from "./plan-week.js";

const cand = (id: string, over: Partial<PlanCandidate> = {}): PlanCandidate => ({
  id,
  title: `R-${id}`,
  coverage: 0.8,
  missing: [],
  usesExpiring: 0,
  ...over,
});

const input = (candidates: PlanCandidate[], over: Partial<PlanWeekInput> = {}): PlanWeekInput => ({
  candidates,
  expiringNames: [],
  prefs: { diets: [], allergens: [], dislikes: [] },
  budgetCents: null,
  ...over,
});

describe("buildFallbackPlan", () => {
  it("orders by expiring-users first, then coverage", () => {
    const p = buildFallbackPlan(
      input([
        cand("low-cov", { coverage: 0.4, usesExpiring: 0 }),
        cand("expiring", { coverage: 0.3, usesExpiring: 2, expiringIngredients: ["spinach", "kale"] }),
        cand("high-cov", { coverage: 0.9, usesExpiring: 0 }),
      ]),
      3,
    );
    expect(p.dinners.map((d) => d.recipeId)).toEqual(["expiring", "high-cov", "low-cov"]);
    expect(p.dinners[0]!.usesExpiring).toEqual(["spinach", "kale"]);
    expect(p.dinners.map((d) => d.day)).toEqual(["Monday", "Tuesday", "Wednesday"]);
  });

  it("caps at the target and de-dupes the shopping gap", () => {
    const p = buildFallbackPlan(
      input([
        cand("a", { missing: ["garlic", "rice"] }),
        cand("b", { missing: ["rice", "egg"] }),
        cand("c", { missing: ["oil"] }),
      ]),
      2,
    );
    expect(p.dinners).toHaveLength(2);
    expect(p.addToList.sort()).toEqual(["egg", "garlic", "rice"]); // c's "oil" excluded; "rice" deduped
    expect(p.narrative).toMatch(/2-dinner week/);
  });

  it("handles an empty pantry gracefully", () => {
    const p = buildFallbackPlan(input([]), 5);
    expect(p.dinners).toEqual([]);
    expect(p.addToList).toEqual([]);
    expect(p.narrative).toMatch(/add a few pantry items/i);
  });
});

describe("planWeek", () => {
  const validPlan = {
    narrative: "A calm, simple week of dinners ahead.",
    dinners: [{ recipeId: "a", day: "Monday", title: "R-a", reason: "good", usesExpiring: [] }],
    addToList: [],
  };

  it("uses the generator's plan when it verifies (source=llm)", async () => {
    const gen: PlanGenerator = async (req) => {
      const v = req.verify(validPlan);
      if (!v.ok) throw new Error(v.reason);
      return validPlan;
    };
    const res = await planWeek(input([cand("a")], { targetDinners: 1 }), { generate: gen });
    expect(res.source).toBe("llm");
    expect(res.plan.narrative).toBe(validPlan.narrative);
    expect(res.evaluation.ok).toBe(true);
  });

  it("falls back deterministically when the generator throws (source=fallback)", async () => {
    const gen: PlanGenerator = async () => {
      throw new Error("API key expired");
    };
    const res = await planWeek(input([cand("a"), cand("b")], { targetDinners: 2 }), { generate: gen });
    expect(res.source).toBe("fallback");
    expect(res.plan.dinners).toHaveLength(2);
  });

  it("falls back when no generator is provided", async () => {
    const res = await planWeek(input([cand("a")], { targetDinners: 1 }));
    expect(res.source).toBe("fallback");
    expect(res.plan.dinners[0]!.recipeId).toBe("a");
  });

  it("hands the generator a verify() that rejects invalid picks and accepts valid ones", async () => {
    let captured: Parameters<PlanGenerator>[0] | null = null;
    const gen: PlanGenerator = async (req) => {
      captured = req;
      throw new Error("stop after capture");
    };
    await planWeek(input([cand("a")], { targetDinners: 1 }), { generate: gen });

    expect(captured).not.toBeNull();
    const verify = captured!.verify;
    expect(
      verify({ narrative: "x", dinners: [{ recipeId: "zzz", day: "Mon", title: "t", reason: "r", usesExpiring: [] }], addToList: [] }).ok,
    ).toBe(false);
    expect(verify(validPlan).ok).toBe(true);
  });

  it("skips the LLM entirely with no candidates", async () => {
    let called = false;
    const gen: PlanGenerator = async () => {
      called = true;
      return validPlan;
    };
    const res = await planWeek(input([]), { generate: gen });
    expect(called).toBe(false);
    expect(res.source).toBe("fallback");
  });
});
