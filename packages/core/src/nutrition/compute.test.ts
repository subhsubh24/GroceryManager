import { describe, expect, it } from "vitest";
import {
  EMPTY_MACROS,
  addMacros,
  gramsFromMeasure,
  macrosFromPer100g,
  roundMacros,
  scaleMacros,
} from "./compute.js";

describe("addMacros", () => {
  it("sums component-wise", () => {
    expect(
      addMacros(
        { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 },
        { kcal: 50, proteinG: 3, carbsG: 4, fatG: 1 },
      ),
    ).toEqual({ kcal: 150, proteinG: 8, carbsG: 14, fatG: 3 });
  });

  it("EMPTY_MACROS is the additive identity", () => {
    const m = { kcal: 42, proteinG: 1, carbsG: 2, fatG: 3 };
    expect(addMacros(m, EMPTY_MACROS)).toEqual(m);
  });
});

describe("scaleMacros", () => {
  it("scales every component by the factor", () => {
    expect(scaleMacros({ kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 }, 2)).toEqual({
      kcal: 200,
      proteinG: 10,
      carbsG: 20,
      fatG: 4,
    });
  });

  it("scaling by 0 yields zeros", () => {
    expect(scaleMacros({ kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 }, 0)).toEqual(EMPTY_MACROS);
  });
});

describe("roundMacros", () => {
  it("rounds kcal to an integer and grams to one decimal", () => {
    expect(roundMacros({ kcal: 123.4, proteinG: 5.27, carbsG: 10.04, fatG: 2.95 })).toEqual({
      kcal: 123,
      proteinG: 5.3,
      carbsG: 10,
      fatG: 3,
    });
  });
});

describe("gramsFromMeasure", () => {
  it("passes grams through and converts other mass units", () => {
    expect(gramsFromMeasure(200, "g")).toBe(200);
    expect(gramsFromMeasure(1, "kg")).toBe(1000);
    expect(gramsFromMeasure(500, "mg")).toBe(0.5);
    expect(gramsFromMeasure(1, "oz")).toBeCloseTo(28.3495, 4);
    expect(gramsFromMeasure(1, "lb")).toBeCloseTo(453.592, 3);
  });

  it("returns null for volume / count / unknown / null units", () => {
    expect(gramsFromMeasure(1, "cup")).toBeNull();
    expect(gramsFromMeasure(2, "tbsp")).toBeNull();
    expect(gramsFromMeasure(3, null)).toBeNull(); // a bare count, e.g. "3" eggs
  });
});

describe("macrosFromPer100g", () => {
  it("scales per-100g figures to the actual gram weight", () => {
    // 200g of a food at 165 kcal / 31g protein / 0g carbs / 3.6g fat per 100g.
    expect(macrosFromPer100g({ kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 }, 200)).toEqual({
      kcal: 330,
      proteinG: 62,
      carbsG: 0,
      fatG: 7.2,
    });
  });

  it("50g halves the per-100g values", () => {
    expect(macrosFromPer100g({ kcal: 100, proteinG: 10, carbsG: 20, fatG: 4 }, 50)).toEqual({
      kcal: 50,
      proteinG: 5,
      carbsG: 10,
      fatG: 2,
    });
  });
});
