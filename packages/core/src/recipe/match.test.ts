import { describe, expect, it } from "vitest";
import {
  annotateRecipe,
  buildPantryIndex,
  normalizeIngredientName,
  rankRecipes,
  type RawRecipe,
} from "./match.js";

const pantry = buildPantryIndex([
  { name: "whole milk", aliases: ["milk"], inStock: true },
  { name: "large egg", aliases: ["egg", "eggs"], inStock: true },
  { name: "baby spinach", aliases: ["spinach"], inStock: true, expiringSoon: true },
  { name: "garlic", inStock: true },
]);

describe("pantry index matching", () => {
  it("matches messy recipe ingredient strings to pantry items (incl. aliases)", () => {
    expect(pantry.has("1 cup whole milk")).toBe(true);
    expect(pantry.has("2 large eggs, beaten")).toBe(true);
    expect(pantry.has("3 cloves garlic, minced")).toBe(true);
    expect(pantry.has("fresh spinach (a handful)")).toBe(true);
    expect(pantry.has("saffron threads")).toBe(false);
  });

  it("knows which matches are expiring soon", () => {
    expect(pantry.expiring("baby spinach")).toBe(true);
    expect(pantry.expiring("whole milk")).toBe(false);
  });

  it("normalizes names", () => {
    expect(normalizeIngredientName("2 cups Organic Baby-Spinach!")).toBe("2 cups organic baby spinach");
  });
});

describe("rankRecipes", () => {
  const recipes: RawRecipe[] = [
    { id: "omelette", title: "Spinach omelette", ingredients: [{ name: "eggs" }, { name: "spinach" }, { name: "garlic" }], effortScore: 0.2 },
    { id: "carbonara", title: "Carbonara", ingredients: [{ name: "spaghetti" }, { name: "eggs" }, { name: "pancetta" }, { name: "parmesan" }] },
    { id: "milkshake", title: "Milkshake", ingredients: [{ name: "whole milk" }, { name: "banana" }, { name: "ice cream" }] },
  ];
  const annotated = recipes.map((r) => annotateRecipe(r, pantry));

  it("ranks fully-stocked, expiring-using recipes first", () => {
    const ranked = rankRecipes(annotated);
    expect(ranked[0]!.id).toBe("omelette"); // 3/3 have, uses expiring spinach
    expect(ranked[0]!.coverage).toBe(1);
    expect(ranked[0]!.usesExpiring).toBe(1);
  });

  it("reports the missing ingredients", () => {
    const carbonara = rankRecipes(annotated).find((r) => r.id === "carbonara")!;
    expect(carbonara.missing.sort()).toEqual(["pancetta", "parmesan", "spaghetti"]);
    expect(carbonara.haveCount).toBe(1); // eggs
  });

  it("low-energy mode rewards low-effort recipes", () => {
    const normal = rankRecipes(annotated).find((r) => r.id === "omelette")!.score;
    const lowE = rankRecipes(annotated, { lowEnergy: true }).find((r) => r.id === "omelette")!.score;
    expect(lowE).toBeGreaterThan(normal); // effortScore 0.2 → strong effortFit boost
  });
});
