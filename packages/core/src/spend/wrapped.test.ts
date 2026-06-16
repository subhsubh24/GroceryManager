import { describe, expect, it } from "vitest";
import { buildWrapped, type WrappedInput } from "./wrapped.js";

const d = (s: string) => new Date(s);

const base: WrappedInput = {
  mealLogs: [],
  purchases: [],
  spoilageCount: 0,
  windowDays: 30,
};

describe("buildWrapped", () => {
  it("counts home-cooked meals and sums spend (null totals safe)", () => {
    const w = buildWrapped({
      ...base,
      mealLogs: [
        { cookedAt: d("2026-06-01"), recipeTitle: "Omelette" },
        { cookedAt: d("2026-06-02"), recipeTitle: null },
      ],
      purchases: [{ totalCents: 1234 }, { totalCents: null }, { totalCents: 766 }],
    });
    expect(w.homeCookedMeals).toBe(2);
    expect(w.totalSpentCents).toBe(2000);
  });

  it("estimates savings as meals × per-meal delta (takeout − home)", () => {
    const w = buildWrapped({
      ...base,
      mealLogs: Array.from({ length: 4 }, () => ({ cookedAt: d("2026-06-01"), recipeTitle: "X" })),
    });
    // 4 × (1500 − 500) = 4000
    expect(w.estSavedCents).toBe(4000);
  });

  it("clamps estSaved ≥ 0 and is 0 with no cooked meals", () => {
    const w = buildWrapped(base);
    expect(w.estSavedCents).toBe(0);
    expect(w.homeCookedMeals).toBe(0);
  });

  it("ranks top recipes by count, breaking ties by title, capped at 5", () => {
    const titles = ["Tacos", "Tacos", "Tacos", "Curry", "Curry", "Soup", "Pasta", "Pizza", "Pho", "Rice"];
    const w = buildWrapped({
      ...base,
      mealLogs: titles.map((t) => ({ cookedAt: d("2026-06-01"), recipeTitle: t })),
    });
    expect(w.topRecipes.length).toBe(5);
    expect(w.topRecipes[0]).toEqual({ title: "Tacos", count: 3 });
    expect(w.topRecipes[1]).toEqual({ title: "Curry", count: 2 });
    // remaining are count-1, alphabetical: Pasta, Pho, Pizza
    expect(w.topRecipes.slice(2).map((r) => r.title)).toEqual(["Pasta", "Pho", "Pizza"]);
  });

  it("ignores blank/whitespace titles in the recipe ranking", () => {
    const w = buildWrapped({
      ...base,
      mealLogs: [
        { cookedAt: d("2026-06-01"), recipeTitle: "  " },
        { cookedAt: d("2026-06-01"), recipeTitle: null },
        { cookedAt: d("2026-06-01"), recipeTitle: "Real" },
      ],
    });
    expect(w.topRecipes).toEqual([{ title: "Real", count: 1 }]);
  });

  it("passes through spoilage as itemsExpired", () => {
    expect(buildWrapped({ ...base, spoilageCount: 7 }).itemsExpired).toBe(7);
  });

  it("labels the period from windowDays", () => {
    expect(buildWrapped({ ...base, windowDays: 7 }).periodLabel).toBe("this week");
    expect(buildWrapped({ ...base, windowDays: 30 }).periodLabel).toBe("this month");
    expect(buildWrapped({ ...base, windowDays: 90 }).periodLabel).toBe("this quarter");
    expect(buildWrapped({ ...base, windowDays: 365 }).periodLabel).toBe("this year");
    expect(buildWrapped({ ...base, windowDays: 400 }).periodLabel).toBe("the last 400 days");
  });
});
