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

describe("rankRecipes with personalization", () => {
  const recipes = (
    [
      { id: "thai", title: "Thai curry", ingredients: [{ name: "eggs" }, { name: "spinach" }], cuisine: "Thai" },
      { id: "italian", title: "Frittata", ingredients: [{ name: "eggs" }, { name: "spinach" }], cuisine: "Italian" },
      { id: "peanutty", title: "Peanut stew", ingredients: [{ name: "eggs" }, { name: "peanuts" }] },
    ] as RawRecipe[]
  ).map((r) => annotateRecipe(r, pantry));

  it("hard-excludes recipes containing an allergen", () => {
    const ranked = rankRecipes(recipes, { prefs: { allergens: ["peanut"] } });
    expect(ranked.some((r) => r.id === "peanutty")).toBe(false);
  });

  it("boosts a loved cuisine to the top", () => {
    const ranked = rankRecipes(recipes, { prefs: { cuisineAffinity: { thai: 0.9 } } });
    expect(ranked[0]!.id).toBe("thai");
  });

  it("boosts a recipe containing a loved ingredient", () => {
    // `loves` are ingredient-level preferences (distinct from cuisineAffinity) learned from meal
    // logging — a recipe using a loved ingredient should score above the same recipe without the pref.
    const base = rankRecipes(recipes).find((r) => r.id === "thai")!.score;
    const loved = rankRecipes(recipes, { prefs: { loves: ["eggs"] } }).find((r) => r.id === "thai")!.score;
    expect(loved).toBeGreaterThan(base); // thai has eggs → love boost applied
  });

  it("penalizes a recipe containing a disliked ingredient (without excluding it)", () => {
    // Unlike allergens, a `dislike` is a soft penalty — the recipe still appears, just ranked lower.
    const base = rankRecipes(recipes).find((r) => r.id === "peanutty")!.score;
    const disliked = rankRecipes(recipes, { prefs: { dislikes: ["peanuts"] } }).find((r) => r.id === "peanutty")!;
    expect(disliked.score).toBeLessThan(base); // peanutty has peanuts → dislike penalty
  });
});

describe("rankRecipes – batchCook and limit options", () => {
  const recipes = (
    [
      { id: "stew", title: "Big batch stew", ingredients: [{ name: "eggs" }], batchScore: 0.9 },
      { id: "toast", title: "Fresh toast", ingredients: [{ name: "eggs" }], batchScore: 0.1 },
    ] as RawRecipe[]
  ).map((r) => annotateRecipe(r, pantry));

  it("batch-cook mode up-weights dishes that keep/reheat/scale well", () => {
    const normal = rankRecipes(recipes).find((r) => r.id === "stew")!.score;
    const batch = rankRecipes(recipes, { batchCook: true }).find((r) => r.id === "stew")!.score;
    expect(batch).toBeGreaterThan(normal); // batchScore 0.9 → strong batchFit boost
  });

  it("limit slices the ranked results to the top N", () => {
    expect(rankRecipes(recipes)).toHaveLength(2);
    expect(rankRecipes(recipes, { limit: 1 })).toHaveLength(1);
  });
});

describe("rankRecipes – dietKeywords vs allergens", () => {
  const pbRecipe = (
    [{ id: "pb-cookie", title: "PB Cookie", ingredients: [{ name: "peanut butter" }, { name: "oat" }] }] as RawRecipe[]
  ).map((r) => annotateRecipe(r, pantry));

  const almondMilkRecipe = (
    [{ id: "smoothie", title: "Smoothie", ingredients: [{ name: "almond milk" }, { name: "banana" }] }] as RawRecipe[]
  ).map((r) => annotateRecipe(r, pantry));

  it('dietKeyword "butter" does NOT exclude a recipe whose only "butter" is peanut butter', () => {
    const ranked = rankRecipes(pbRecipe, { prefs: { dietKeywords: ["butter", "milk", "egg"] } });
    expect(ranked.some((r) => r.id === "pb-cookie")).toBe(true);
  });

  it('dietKeyword "milk" does NOT exclude a recipe whose only "milk" is almond milk', () => {
    const ranked = rankRecipes(almondMilkRecipe, { prefs: { dietKeywords: ["milk", "cheese", "butter"] } });
    expect(ranked.some((r) => r.id === "smoothie")).toBe(true);
  });

  it('true allergen "peanut" DOES exclude peanut butter despite the plant-based exemption', () => {
    // Peanut allergy is a real safety concern — the plant-based bypass only applies to dietKeywords.
    const ranked = rankRecipes(pbRecipe, { prefs: { allergens: ["peanut"] } });
    expect(ranked.some((r) => r.id === "pb-cookie")).toBe(false);
  });

  it("plain butter ingredient is still excluded by the dairy-free diet keyword", () => {
    const butterRecipe = (
      [{ id: "beurre-blanc", title: "Beurre blanc", ingredients: [{ name: "butter" }, { name: "shallot" }] }] as RawRecipe[]
    ).map((r) => annotateRecipe(r, pantry));
    const ranked = rankRecipes(butterRecipe, { prefs: { dietKeywords: ["butter"] } });
    expect(ranked.some((r) => r.id === "beurre-blanc")).toBe(false);
  });

  it("quantity-qualified peanut butter string (real API form) is also exempted", () => {
    // Recipes from external APIs list ingredients as "2 tablespoons peanut butter" etc.
    const pbRecipe2 = (
      [{ id: "pb-toast", title: "PB Toast", ingredients: [{ name: "2 tablespoons peanut butter" }, { name: "bread" }] }] as RawRecipe[]
    ).map((r) => annotateRecipe(r, pantry));
    const ranked = rankRecipes(pbRecipe2, { prefs: { dietKeywords: ["butter"] } });
    expect(ranked.some((r) => r.id === "pb-toast")).toBe(true);
  });
});
