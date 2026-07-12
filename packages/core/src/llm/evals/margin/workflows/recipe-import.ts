/**
 * Margin cost-per-outcome eval for RECIPE IMPORT (workflow #11) — structure a recipe from pasted text
 * (the LLM fallback when a page has no schema.org JSON-LD). Grader is the REAL `scoreRecipeImport`
 * (harness) — title + ingredient recall + enough-steps — over the REAL golden fixtures plus edges and
 * deterministic fuzz.
 */
import type { EvalScore } from "../../harness.js";
import { scoreRecipeImport, type ExpectedRecipe } from "../../harness.js";
import { importRecipe } from "../../../../recipe/import-llm.js";
import { RECIPE_FIXTURES } from "../../fixtures.js";
import { syntheticRecipes } from "../fuzz.js";
import type { EvalCase, MarginWorkflowEval } from "./types.js";

export interface RecipeInput {
  text: string;
  expected: ExpectedRecipe;
}

type RecipeOutput = Awaited<ReturnType<typeof importRecipe>>["recipe"];

const goldenCases: EvalCase<RecipeInput>[] = RECIPE_FIXTURES.map((f) => ({
  name: `golden:${f.name}`,
  tags: ["golden", f.text.length > 400 ? "real" : "synthetic"],
  input: { text: f.text, expected: f.expected },
}));

const edgeCases: EvalCase<RecipeInput>[] = [
  {
    name: "edge:minimal",
    tags: ["edge", "minimal"],
    input: {
      text: [
        "Cacio e Pepe",
        "Ingredients: spaghetti, pecorino, black pepper",
        "1. Boil spaghetti. 2. Toss with pecorino and pepper using pasta water. 3. Serve.",
      ].join("\n"),
      expected: { title: "Cacio e Pepe", ingredientNames: ["spaghetti", "pecorino", "black pepper"], minSteps: 3 },
    },
  },
  {
    name: "edge:prose-steps",
    tags: ["edge", "prose"],
    input: {
      text: [
        "Simple Tomato Soup",
        "You'll need: 2 lb tomatoes, 1 onion, 3 cloves garlic, 2 cups stock, basil, olive oil.",
        "Method: Sweat the onion and garlic in olive oil until soft, then add the tomatoes and stock and",
        "simmer for twenty minutes. Blend until smooth, stir through torn basil, season, and serve hot.",
      ].join("\n"),
      expected: {
        title: "Simple Tomato Soup",
        ingredientNames: ["tomatoes", "onion", "garlic", "stock", "basil", "olive oil"],
        minSteps: 2,
      },
    },
  },
  {
    name: "edge:fractions-and-measures",
    tags: ["edge", "measures"],
    input: {
      text: [
        "Fluffy Pancakes",
        "1 1/2 cups all-purpose flour",
        "3 1/2 tsp baking powder",
        "1 tbsp sugar",
        "1 1/4 cups milk",
        "1 egg",
        "3 tbsp butter, melted",
        "Steps:",
        "1. Whisk dry ingredients.",
        "2. Add milk, egg and melted butter; whisk to a batter.",
        "3. Cook ladlefuls on a greased griddle until bubbles form, flip, and finish.",
      ].join("\n"),
      expected: {
        title: "Fluffy Pancakes",
        ingredientNames: ["flour", "baking powder", "sugar", "milk", "egg", "butter"],
        minSteps: 3,
      },
    },
  },
  {
    name: "edge:long-12-ingredients",
    tags: ["edge", "long"],
    input: {
      text: [
        "Loaded Veggie Curry",
        "Ingredients:",
        ...[
          "onion", "garlic", "ginger", "curry powder", "coconut milk", "chickpeas", "spinach",
          "cauliflower", "bell pepper", "tomatoes", "basmati rice", "cilantro",
        ].map((i) => `- ${i}`),
        "Instructions:",
        "1. Bloom the aromatics and curry powder in oil.",
        "2. Add coconut milk, tomatoes and the hardy vegetables; simmer.",
        "3. Fold in chickpeas and spinach until wilted.",
        "4. Serve over basmati rice with cilantro.",
      ].join("\n"),
      expected: {
        title: "Loaded Veggie Curry",
        ingredientNames: [
          "onion", "garlic", "ginger", "curry powder", "coconut milk", "chickpeas", "spinach",
          "cauliflower", "bell pepper", "tomatoes", "rice", "cilantro",
        ],
        minSteps: 4,
      },
    },
  },
];

const fuzzCases: EvalCase<RecipeInput>[] = syntheticRecipes(10).map((r) => ({
  name: r.name,
  tags: ["fuzz"],
  input: { text: r.text, expected: r.expected },
}));

export const recipeImportEval: MarginWorkflowEval<RecipeInput, RecipeOutput> = {
  workflowId: "grocerymanager-recipe-import",
  name: "recipe-import",
  spend: "medium",
  about: "Structure a recipe (title/ingredients/steps) from pasted text — the LLM JSON-LD fallback.",
  cases: [...goldenCases, ...edgeCases, ...fuzzCases],
  async run(input, client): Promise<RecipeOutput> {
    const { recipe } = await importRecipe({ text: input.text }, { client });
    return recipe;
  },
  grade(output, input): EvalScore {
    return scoreRecipeImport(output, input.expected);
  },
};
