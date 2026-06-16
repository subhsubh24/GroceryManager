/**
 * Golden eval fixtures (PLAN §12). Sanitized, synthetic-but-realistic inputs with expected outputs.
 * Add a new case here whenever a real receipt/recipe is mis-parsed — that's the ratchet (§8.5).
 */
import type { ExpectedReceipt, ExpectedRecipe } from "./harness.js";

export interface ReceiptFixture {
  name: string;
  retailerHint: string;
  text: string;
  expected: ExpectedReceipt;
}

export const RECEIPT_FIXTURES: ReceiptFixture[] = [
  {
    name: "whole-foods-instore",
    retailerHint: "whole_foods",
    text: [
      "WHOLE FOODS MARKET",
      "365 Market St",
      "Order Receipt",
      "Organic Bananas 2 lb            1.98",
      "Whole Milk 1 gal                4.49",
      "Large Eggs, dozen               5.29",
      "Baby Spinach 5 oz               3.99",
      "Subtotal                       15.75",
      "Tax                             0.00",
      "Total                          15.75",
    ].join("\n"),
    expected: {
      retailer: "whole_foods",
      itemNames: ["bananas", "milk", "eggs", "spinach"],
      totalCents: 1575,
    },
  },
  {
    name: "instacart-delivery",
    retailerHint: "instacart",
    text: [
      "Instacart",
      "Your order was delivered",
      "Receipt",
      "1 x Olive Oil (16.9 fl oz)      9.99",
      "2 x Chicken Breast (1 lb)      12.00",
      "1 x Garlic (3 ct)               1.49",
      "1 x White Rice (2 lb)           3.49",
      "Items Subtotal                 26.97",
      "Service Fee                     3.00",
      "Total                          29.97",
    ].join("\n"),
    expected: {
      retailer: "instacart",
      itemNames: ["olive oil", "chicken breast", "garlic", "rice"],
      totalCents: 2997,
    },
  },
  {
    name: "amazon-pantry",
    retailerHint: "amazon",
    text: [
      "amazon.com",
      "Your Amazon order has shipped",
      "Order #112-3456789-0011223",
      "Vitamin D3 120 softgels         14.99",
      "Magnesium Glycinate 120 ct      19.99",
      "Paper Towels 6 rolls            12.49",
      "Order Total: $47.47",
    ].join("\n"),
    expected: {
      retailer: "amazon",
      itemNames: ["vitamin d3", "magnesium", "paper towels"],
      totalCents: 4747,
    },
  },
];

export interface RecipeFixture {
  name: string;
  text: string;
  expected: ExpectedRecipe;
}

export const RECIPE_FIXTURES: RecipeFixture[] = [
  {
    name: "garlic-chili-pasta",
    text: [
      "Simple Garlic Chili Pasta",
      "Serves 2",
      "",
      "Ingredients:",
      "- 200 g spaghetti",
      "- 3 cloves garlic, thinly sliced",
      "- 3 tbsp olive oil",
      "- 1/2 tsp chili flakes",
      "- salt, to taste",
      "",
      "Instructions:",
      "1. Boil the spaghetti in salted water until al dente, then drain.",
      "2. Warm the olive oil and gently fry the garlic until golden.",
      "3. Toss the pasta with the garlic oil and chili flakes; season and serve.",
    ].join("\n"),
    expected: {
      title: "Garlic Chili Pasta",
      ingredientNames: ["spaghetti", "garlic", "olive oil", "chili flakes", "salt"],
      minSteps: 3,
    },
  },
  {
    name: "lemon-salmon",
    text: [
      "Lemon Garlic Butter Salmon",
      "Serves 4",
      "",
      "4 salmon fillets",
      "3 tbsp butter, melted",
      "4 cloves garlic, minced",
      "2 tbsp lemon juice",
      "1 tsp salt",
      "chopped parsley",
      "",
      "Preheat oven to 400F.",
      "Whisk butter, garlic, lemon juice and salt.",
      "Brush over the salmon and bake 12-15 minutes.",
      "Garnish with parsley and serve.",
    ].join("\n"),
    expected: {
      title: "Salmon",
      ingredientNames: ["salmon", "butter", "garlic", "lemon", "parsley"],
      minSteps: 3,
    },
  },
];
