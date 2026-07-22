import { describe, expect, it } from "vitest";
import type { GeminiClient } from "../llm/client.js";
import { estimateMealMacros } from "./estimate.js";

// A canned FoodData Central search response: one food with per-100g nutrient rows. Numbers match the
// real payload shape (string nutrientNumber, an Energy row in kcal, protein/carbs/fat).
function fdcResponse(per100: { kcal: number; protein: number; carbs: number; fat: number }): unknown {
  return {
    foods: [
      {
        description: "Test food",
        foodNutrients: [
          { nutrientNumber: "208", nutrientName: "Energy", unitName: "KCAL", value: per100.kcal },
          { nutrientNumber: "203", nutrientName: "Protein", unitName: "G", value: per100.protein },
          { nutrientNumber: "205", nutrientName: "Carbohydrate, by difference", unitName: "G", value: per100.carbs },
          { nutrientNumber: "204", nutrientName: "Total lipid (fat)", unitName: "G", value: per100.fat },
        ],
      },
    ],
  };
}

// A fetch that always returns the same canned FDC body (200 OK).
const fdcFetch = (per100: { kcal: number; protein: number; carbs: number; fat: number }): typeof fetch =>
  (async () => new Response(JSON.stringify(fdcResponse(per100)), { status: 200 })) as unknown as typeof fetch;

// A fetch that returns "no match" (empty foods array).
const noMatchFetch: typeof fetch = (async () =>
  new Response(JSON.stringify({ foods: [] }), { status: 200 })) as unknown as typeof fetch;

// A fake LLM whose generateStructured always returns the given macros (the per-recipe combined total).
const fakeLlm = (macros: { kcal: number; proteinG: number; carbsG: number; fatG: number }): GeminiClient =>
  ({ generateStructured: async () => macros }) as unknown as GeminiClient;

describe("estimateMealMacros", () => {
  it("uses FDC (primary) for a mass-quantity ingredient", async () => {
    const macros = await estimateMealMacros(
      [{ name: "chicken breast", measure: "200 g" }],
      1,
      { fdcApiKey: "k", fetchImpl: fdcFetch({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }) },
    );
    // 200g ⇒ 2× the per-100g figures.
    expect(macros).toEqual({ kcal: 330, proteinG: 62, carbsG: 0, fatG: 7.2, source: "fdc", confidence: 1 });
  });

  it("falls back to the LLM for a count/volume ingredient FDC can't mass", async () => {
    const macros = await estimateMealMacros(
      [{ name: "garlic", measure: "2 cloves" }],
      1,
      {
        fdcApiKey: "k",
        fetchImpl: fdcFetch({ kcal: 100, protein: 1, carbs: 1, fat: 1 }), // never consulted: no grams
        llm: fakeLlm({ kcal: 9, proteinG: 0.4, carbsG: 2, fatG: 0 }),
      },
    );
    expect(macros).toEqual({ kcal: 9, proteinG: 0.4, carbsG: 2, fatG: 0, source: "llm", confidence: 0.3 });
  });

  it("reports 'mixed' when FDC handles one ingredient and the LLM the other", async () => {
    const macros = await estimateMealMacros(
      [
        { name: "chicken breast", measure: "100 g" }, // FDC
        { name: "garlic", measure: "2 cloves" }, // LLM
      ],
      1,
      {
        fdcApiKey: "k",
        fetchImpl: fdcFetch({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }),
        llm: fakeLlm({ kcal: 9, proteinG: 0.4, carbsG: 2, fatG: 0 }),
      },
    );
    expect(macros.source).toBe("mixed");
    // 100g chicken (165/31/0/3.6) + LLM garlic (9/0.4/2/0).
    expect(macros.kcal).toBe(174);
    expect(macros.proteinG).toBeCloseTo(31.4, 5);
    expect(macros.carbsG).toBe(2);
    expect(macros.fatG).toBeCloseTo(3.6, 5);
    // Half the considered ingredients resolved by FDC ⇒ confidence 0.5.
    expect(macros.confidence).toBe(0.5);
  });

  it("scales the whole estimate by servings", async () => {
    const one = await estimateMealMacros(
      [{ name: "chicken breast", measure: "200 g" }],
      1,
      { fdcApiKey: "k", fetchImpl: fdcFetch({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }) },
    );
    const two = await estimateMealMacros(
      [{ name: "chicken breast", measure: "200 g" }],
      2,
      { fdcApiKey: "k", fetchImpl: fdcFetch({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }) },
    );
    expect(two.kcal).toBe(one.kcal * 2);
    expect(two.proteinG).toBeCloseTo(one.proteinG * 2, 5);
    expect(two.fatG).toBeCloseTo(one.fatG * 2, 5);
  });

  it("scales DOWN for a fractional serving (half a recipe ⇒ half the macros)", async () => {
    // A half-batch cook (servings 0.5) must log half the macros so the stored figure matches the
    // pantry drawdown (planConsumption scales by the same 0.5). Regression: `Math.max(1, servings)`
    // used to clamp 0.5 → 1, logging full-recipe macros for a half batch.
    const full = await estimateMealMacros(
      [{ name: "chicken breast", measure: "200 g" }],
      1,
      { fdcApiKey: "k", fetchImpl: fdcFetch({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }) },
    );
    const half = await estimateMealMacros(
      [{ name: "chicken breast", measure: "200 g" }],
      0.5,
      { fdcApiKey: "k", fetchImpl: fdcFetch({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }) },
    );
    expect(half.kcal).toBe(Math.round(full.kcal * 0.5));
    expect(half.proteinG).toBeCloseTo(full.proteinG * 0.5, 5);
    expect(half.fatG).toBeCloseTo(full.fatG * 0.5, 5);
  });

  it("defaults a non-positive or non-finite serving to a full 1×", async () => {
    const one = await estimateMealMacros(
      [{ name: "chicken breast", measure: "200 g" }],
      1,
      { fdcApiKey: "k", fetchImpl: fdcFetch({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }) },
    );
    for (const bad of [0, -2, Number.NaN]) {
      const macros = await estimateMealMacros(
        [{ name: "chicken breast", measure: "200 g" }],
        bad,
        { fdcApiKey: "k", fetchImpl: fdcFetch({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }) },
      );
      expect(macros.kcal).toBe(one.kcal);
      expect(macros.proteinG).toBeCloseTo(one.proteinG, 5);
    }
  });

  it("skips optional ingredients", async () => {
    let llmCalls = 0;
    const countingLlm = {
      generateStructured: async () => {
        llmCalls++;
        return { kcal: 1, proteinG: 1, carbsG: 1, fatG: 1 };
      },
    } as unknown as GeminiClient;

    const macros = await estimateMealMacros(
      [
        { name: "chicken breast", measure: "200 g" },
        { name: "parsley", measure: "1 tbsp", isOptional: true }, // would need the LLM — but skipped
      ],
      1,
      { fdcApiKey: "k", fetchImpl: fdcFetch({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }), llm: countingLlm },
    );
    expect(macros.source).toBe("fdc"); // optional ingredient never reached the LLM
    expect(llmCalls).toBe(0);
    expect(macros.kcal).toBe(330);
  });

  it("returns source 'none' / confidence 0 when there's no FDC key and no LLM", async () => {
    const macros = await estimateMealMacros([{ name: "chicken breast", measure: "200 g" }], 1, {});
    expect(macros).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, source: "none", confidence: 0 });
  });

  it("falls back to the LLM when FDC returns no match", async () => {
    const macros = await estimateMealMacros(
      [{ name: "obscure ingredient", measure: "100 g" }],
      1,
      { fdcApiKey: "k", fetchImpl: noMatchFetch, llm: fakeLlm({ kcal: 50, proteinG: 2, carbsG: 5, fatG: 1 }) },
    );
    expect(macros).toEqual({ kcal: 50, proteinG: 2, carbsG: 5, fatG: 1, source: "llm", confidence: 0.3 });
  });

  it("never throws — an LLM failure degrades to source 'none' for that part", async () => {
    const throwingLlm = {
      generateStructured: async () => {
        throw new Error("LLM unavailable");
      },
    } as unknown as GeminiClient;
    const macros = await estimateMealMacros(
      [{ name: "garlic", measure: "2 cloves" }],
      1,
      { fdcApiKey: "k", fetchImpl: noMatchFetch, llm: throwingLlm },
    );
    expect(macros).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, source: "none", confidence: 0 });
  });
});
