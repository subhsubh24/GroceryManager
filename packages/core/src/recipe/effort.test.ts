import { describe, expect, it } from "vitest";
import { estimateEffort } from "./effort.js";

describe("estimateEffort", () => {
  it("rates a no-cook, few-ingredient item as low effort", () => {
    const e = estimateEffort({ ingredientCount: 3, instructions: "No-cook. Mix everything in a bowl and serve." });
    expect(e.effortScore).toBeLessThan(0.4);
    expect(e.cleanupLoad).toBe("low");
    expect(e.onePan).toBe(true);
  });

  it("rates a many-ingredient, many-step recipe as higher effort", () => {
    const big = estimateEffort({
      ingredientCount: 14,
      instructions:
        "Marinate the chicken. Saute the onions. Fry the spices. Boil the rice. Roast the vegetables. Simmer the sauce. Whisk the eggs. Bake for 40 minutes.",
    });
    const small = estimateEffort({ ingredientCount: 3, instructions: "Toss and serve." });
    expect(big.effortScore).toBeGreaterThan(small.effortScore);
    expect(big.cleanupLoad).not.toBe("low");
  });

  it("rates a mid-complexity, multi-pan recipe as med cleanup", () => {
    // 9 ingredients + 5 sentence-steps + 5 cook verbs, no one-pan hint → effortScore lands in the
    // [0.4, 0.7) band, the "med" cleanup tier the low/high tests never exercise. This is the tier
    // the low-energy ranking uses to keep a moderate recipe from reading as "easy".
    const e = estimateEffort({
      ingredientCount: 9,
      instructions:
        "Boil the pasta. Fry the onions. Saute the garlic. Simmer the sauce. Roast the peppers.",
    });
    expect(e.onePan).toBe(false);
    expect(e.effortScore).toBeGreaterThanOrEqual(0.4);
    expect(e.effortScore).toBeLessThan(0.7);
    expect(e.cleanupLoad).toBe("med");
  });

  it("one-pan reduces the score", () => {
    const instr = "Saute and simmer everything.";
    const normal = estimateEffort({ ingredientCount: 8, instructions: instr });
    const onePan = estimateEffort({ ingredientCount: 8, instructions: `One-pan: ${instr}` });
    expect(onePan.effortScore).toBeLessThan(normal.effortScore);
  });

  it("treats a recipe with no instructions as pure ingredient-count effort", () => {
    // Provider recipes (semantic-layer.ts passes r.instructions straight through) can arrive with
    // null/empty instructions. Guards the `instructions ?? ""` coalescing and the false arm of
    // `instr.trim() ? 1 : 0` — an empty body must contribute 0 steps, never a phantom step.
    const none = estimateEffort({ ingredientCount: 6 });
    const nulled = estimateEffort({ ingredientCount: 6, instructions: null });
    const oneSentence = estimateEffort({ ingredientCount: 6, instructions: "Mix and serve." });
    expect(nulled.effortScore).toBe(none.effortScore);
    // 0 steps < 1 step at the same ingredient count → strictly less effort (fails if the ternary flips).
    expect(none.effortScore).toBeLessThan(oneSentence.effortScore);
    expect(none.onePan).toBe(false);
    expect(none.cleanupLoad).toBe("low");
  });
});
