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

  it("one-pan reduces the score", () => {
    const instr = "Saute and simmer everything.";
    const normal = estimateEffort({ ingredientCount: 8, instructions: instr });
    const onePan = estimateEffort({ ingredientCount: 8, instructions: `One-pan: ${instr}` });
    expect(onePan.effortScore).toBeLessThan(normal.effortScore);
  });
});
