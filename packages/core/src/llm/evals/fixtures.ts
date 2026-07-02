/**
 * Golden eval fixtures (PLAN §12). RECEIPT_FIXTURES are REAL captured order emails (sanitized of any
 * personal info — referral codes, names, card/order numbers), with human-verified expected items = the
 * ground truth. A real fixture proves the model on real-world messiness (replacements, refunds, weight
 * adjustments, retailer quirks); a synthetic one only proves the pipeline. Add a real mis-parsed case
 * here whenever one is found — that's the ratchet (§8.5). (Recipe fixtures below are still synthetic —
 * swap in real recipe imports the same way.)
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
    // REAL — Whole Foods Market pickup order (via Amazon), clean line-item list.
    name: "real-wholefoods-pickup",
    retailerHint: "whole_foods",
    text: [
      "Whole Foods Market — Order Summary",
      "Order placed June 30, 2026",
      "Pickup at West Loop, Chicago, IL",
      "Purchased at Whole Foods Market",
      "Fage Plain Lactose Free Yogurt, 32 OZ                         $7.69",
      "Applegate Farms Roasted Shredded Chicken Breast, 8 OZ         $7.99",
      "Whole Foods Market Seafood Single Meal                        $13.00",
      "GOTHAM GREENS Basil, 1.25 OZ                                  $3.99",
      "365 by Whole Foods Market Super Seed Blend, 16 OZ            $12.99",
      "365 by Whole Foods Market Organic Lactose Free Reduced Fat Milk, 64 FZ   $5.39",
      "Cascadian Farm Organic Cookies n' creme Granola, 11 OZ        $5.79",
      "Organic Blueberries Pint                                      $4.99",
      "365 by Whole Foods Market Organic Baby Spinach Salad, 5 OZ    $3.89",
      "Whole Foods Market Organic Watermelon Juice, 16 FZ           $6.79",
      "Item(s) Subtotal: $72.51",
      "Grand Total: $72.51",
    ].join("\n"),
    expected: {
      retailer: "whole_foods",
      itemNames: [
        "yogurt",
        "chicken breast",
        "seafood",
        "basil",
        "seed blend",
        "milk",
        "granola",
        "blueberries",
        "spinach",
        "watermelon juice",
      ],
      totalCents: 7251,
    },
  },
  {
    // REAL — Instacart order from Mariano's, with real-world MESS: a refund (Organics Basil, excluded),
    // approved replacements, and weight adjustments. The hard case the pantry must get right.
    name: "real-instacart-marianos",
    retailerHint: "instacart",
    text: [
      "Instacart — Your Instacart order receipt",
      "Your order from Mariano's was delivered on June 28, 2026",
      "16 Items Found · 5 Adjustments",
      "Not charged (refunded): Organics Basil (0.75 oz)",
      "Replacements (approved):",
      "  Private Selection Traditional Pizza Sauce (14 oz)    1 x $3.99   (replaced Carbone Pizza Sauce)",
      "  Fresh Bunch of Bananas – 5-7 Bananas (~ 3 lb)        0.8 lb x $0.79   (replaced Organic Bananas)",
      "  Grapery Grapes, Cotton Candy (per unit)              2.1 lb x $4.99   $10.48",
      "Items found (Mariano's):",
      "  Simple Truth Sliced Strawberries Blueberries & Mango Organic Smoothie Blend (32 oz)   $13.99",
      "  Kroger 100% Lemon Juice (15 fl oz)                   $2.99",
      "  MUSH Vanilla Bean Overnight Oats (5 oz)              2 x $1.89",
      "  Christopher Ranch Organic Peeled Garlic (6 oz)       $3.99",
      "  Simple Truth Grated Parmesan Cheese (5 oz)           $4.99",
      "  De Cecco Penne Rigate, No. 41 (1 lb)                 $3.89",
      "  Rao's Marinara Sauce (24 oz)                         $8.99",
      "  Simple Truth Organic Baby Bella Mushrooms (8 oz)     $3.79",
      "Items Subtotal $128.33",
      "Total $152.31",
    ].join("\n"),
    expected: {
      retailer: "instacart",
      // The delivered items (the refunded basil is intentionally excluded). Fee-inclusive total is
      // ambiguous for a pantry, so totalCents is omitted — item recall is what matters here.
      itemNames: [
        "smoothie blend",
        "lemon juice",
        "overnight oats",
        "garlic",
        "parmesan",
        "penne",
        "marinara",
        "mushrooms",
        "pizza sauce",
        "bananas",
        "cotton candy grapes",
      ],
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
