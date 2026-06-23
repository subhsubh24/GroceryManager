import { describe, expect, it } from "vitest";
import { extractTimerMinutes, scaleMeasure, splitSteps } from "./cook.js";

describe("splitSteps", () => {
  it("returns [] for empty/nullish", () => {
    expect(splitSteps(null)).toEqual([]);
    expect(splitSteps("")).toEqual([]);
    expect(splitSteps("   ")).toEqual([]);
  });

  it("splits on newlines and strips STEP / numbered labels", () => {
    expect(splitSteps("STEP 1: Preheat the oven\nSTEP 2: Bake")).toEqual(["Preheat the oven", "Bake"]);
    expect(splitSteps("1. Chop\n2) Fry\n3 - Serve")).toEqual(["Chop", "Fry", "Serve"]);
  });

  it("drops bare label-only lines", () => {
    expect(splitSteps("STEP 1\nDo the thing\nSTEP 2\nDo more")).toEqual(["Do the thing", "Do more"]);
  });

  it("falls back to sentence splitting for a single blob", () => {
    expect(splitSteps("Preheat the oven. Mix the flour well. Bake for twenty.")).toEqual([
      "Preheat the oven.",
      "Mix the flour well.",
      "Bake for twenty.",
    ]);
  });
});

describe("extractTimerMinutes", () => {
  it("reads minutes and hours", () => {
    expect(extractTimerMinutes("simmer for 10 minutes")).toBe(10);
    expect(extractTimerMinutes("rest 30 mins")).toBe(30);
    expect(extractTimerMinutes("bake 1 hour")).toBe(60);
    expect(extractTimerMinutes("cook 1.5 hours")).toBe(90);
    expect(extractTimerMinutes("rest 1½ hours")).toBe(90);
  });

  it("returns the longest duration when several are present", () => {
    expect(extractTimerMinutes("boil 5 min, then simmer 20 minutes")).toBe(20);
  });

  it("returns null when there is no timer (no false positives)", () => {
    expect(extractTimerMinutes("add salt and pepper")).toBeNull();
    expect(extractTimerMinutes("2 medium onions, diced")).toBeNull();
  });
});

describe("scaleMeasure", () => {
  it("scales the leading quantity, keeping the unit text", () => {
    expect(scaleMeasure("200g", 2)).toBe("400g");
    expect(scaleMeasure("1 1/2 cups", 2)).toBe("3 cups");
    expect(scaleMeasure("3 large eggs", 3)).toBe("9 large eggs");
    expect(scaleMeasure("½ cup", 2)).toBe("1 cup");
  });

  it("renders common fractions when scaling produces them", () => {
    expect(scaleMeasure("1/4 tsp", 2)).toBe("½ tsp");
  });

  it("scales both ends of a range", () => {
    expect(scaleMeasure("1-2 tbsp", 2)).toBe("2-4 tbsp");
    expect(scaleMeasure("1 to 2 cloves", 2)).toBe("2 to 4 cloves");
  });

  it("passes non-numeric and ×1 through unchanged", () => {
    expect(scaleMeasure("to taste", 2)).toBe("to taste");
    expect(scaleMeasure("", 2)).toBe("");
    expect(scaleMeasure("2 cups", 1)).toBe("2 cups");
  });

  it("scales unicode fractions that parseMeasure already handles (⅛ ⅜ ⅝ ⅞)", () => {
    // ⅛ tsp is common in recipes ("⅛ tsp salt" × 2 must become "¼ tsp", not pass through unchanged)
    expect(scaleMeasure("⅛ tsp", 2)).toBe("¼ tsp");
    expect(scaleMeasure("⅛ cup", 4)).toBe("½ cup");
    expect(scaleMeasure("⅜ tsp", 2)).toBe("¾ tsp");
    expect(scaleMeasure("⅝ cup", 2)).toBe("1¼ cup");
    expect(scaleMeasure("⅞ tsp", 2)).toBe("1¾ tsp");
    // mixed number with these fractions
    expect(scaleMeasure("1⅛ cups", 2)).toBe("2¼ cups");
  });
});
