import { describe, expect, it } from "vitest";
import { clampMacros } from "./log-cook.js";

describe("clampMacros", () => {
  it("passes through normal values unchanged", () => {
    const m = { kcal: 650, proteinG: 35, carbsG: 60, fatG: 20, source: "fdc" as const, confidence: 0.9 };
    expect(clampMacros(m)).toEqual(m);
  });

  it("clamps kcal above 10 000 to 10 000", () => {
    const result = clampMacros({ kcal: 99999, proteinG: 30, carbsG: 50, fatG: 15, source: "llm" as const, confidence: 0.5 });
    expect(result.kcal).toBe(10_000);
  });

  it("clamps macronutrients above 500 g to 500 g", () => {
    const result = clampMacros({ kcal: 500, proteinG: 1000, carbsG: 800, fatG: 600, source: "llm" as const, confidence: 0.5 });
    expect(result.proteinG).toBe(500);
    expect(result.carbsG).toBe(500);
    expect(result.fatG).toBe(500);
  });

  it("clamps negative values to 0", () => {
    const result = clampMacros({ kcal: -10, proteinG: -5, carbsG: -1, fatG: -20, source: "llm" as const, confidence: 0.5 });
    expect(result.kcal).toBe(0);
    expect(result.proteinG).toBe(0);
    expect(result.carbsG).toBe(0);
    expect(result.fatG).toBe(0);
  });

  it("preserves source and confidence unchanged", () => {
    const m = { kcal: 500, proteinG: 20, carbsG: 50, fatG: 15, source: "mixed" as const, confidence: 0.75 };
    const result = clampMacros(m);
    expect(result.source).toBe("mixed");
    expect(result.confidence).toBe(0.75);
  });
});
