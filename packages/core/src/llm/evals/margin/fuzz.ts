/**
 * Deterministic FUZZ generators for the Margin eval matrices.
 *
 * A seeded PRNG (mulberry32) makes every generated case reproducible — same seed ⇒ same cases — so a
 * fuzz run is reviewable and a failure is debuggable, unlike true randomness. Each generated case is
 * SELF-LABELLED: we build the input from a known bag of items, so the expected output (the ground
 * truth the genuine grader checks against) is derived from what we put in — no hand-labelling, no faked
 * grading. Fuzz complements the small hand-authored golden + edge sets with breadth (varied lengths,
 * item mixes, retailers, noise) the goldens can't cover.
 */
import type { ExpectedReceipt, ExpectedRecipe } from "../harness.js";

/** mulberry32 — a tiny, fast, deterministic PRNG. Returns a float in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Rng {
  next(): number;
  int(lo: number, hi: number): number; // inclusive
  pick<T>(xs: readonly T[]): T;
  sample<T>(xs: readonly T[], k: number): T[];
}

function makeRng(seed: number): Rng {
  const r = mulberry32(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = <T>(xs: readonly T[]): T => xs[int(0, xs.length - 1)]!;
  const sample = <T>(xs: readonly T[], k: number): T[] => {
    const pool = [...xs];
    const out: T[] = [];
    for (let i = 0; i < k && pool.length; i++) out.push(pool.splice(int(0, pool.length - 1), 1)[0]!);
    return out;
  };
  return { next: r, int, pick, sample };
}

// ── Receipt fuzz ────────────────────────────────────────────────────────────────────────────────

/** A grocery item: the retailer LINE text, and the generic `name` the grader expects to recall. */
interface GroceryItem {
  line: string; // how it appears on a receipt (brand/size noise included)
  name: string; // the generic name the extractor should surface
}

const GROCERY_ITEMS: readonly GroceryItem[] = [
  { line: "Organic Whole Milk, 1 GAL", name: "milk" },
  { line: "Large Brown Eggs, Dozen", name: "eggs" },
  { line: "Boneless Skinless Chicken Breast, 2 LB", name: "chicken breast" },
  { line: "Hass Avocados, Bag of 4", name: "avocado" },
  { line: "365 Organic Baby Spinach, 5 OZ", name: "spinach" },
  { line: "Barilla Spaghetti, 16 OZ", name: "spaghetti" },
  { line: "Roma Tomatoes, 1.5 LB", name: "tomatoes" },
  { line: "Sharp Cheddar Cheese Block, 8 OZ", name: "cheddar cheese" },
  { line: "Basmati Rice, 32 OZ", name: "rice" },
  { line: "Extra Virgin Olive Oil, 500 ML", name: "olive oil" },
  { line: "Yellow Onions, 3 LB Bag", name: "onions" },
  { line: "Fresh Garlic, 3 ct", name: "garlic" },
  { line: "Greek Yogurt Plain, 32 OZ", name: "yogurt" },
  { line: "Wild Blueberries, 1 Pint", name: "blueberries" },
  { line: "Ground Beef 85/15, 1 LB", name: "ground beef" },
  { line: "Kingsford Applewood Smoked Salmon, 6 OZ", name: "salmon" },
  { line: "Whole Wheat Sandwich Bread, 20 OZ", name: "bread" },
  { line: "Unsalted Butter, 1 LB", name: "butter" },
  { line: "Black Beans Canned, 15 OZ", name: "black beans" },
  { line: "Sweet Corn, 4 ears", name: "corn" },
];

const RETAILERS: readonly string[] = ["whole_foods", "instacart", "kroger", "safeway", "trader_joes"];

const NOISE_LINES: readonly string[] = [
  "Bag fee                                      $0.10",
  "Member savings                              -$2.00",
  "Thank you for shopping with us!",
  "Points earned this order: 152",
  "Tip (100% to your shopper)                   $5.00",
];

/** Build one synthetic receipt (text + self-derived {@link ExpectedReceipt}) at index `i`. */
function synthReceipt(rng: Rng, i: number): { name: string; text: string; retailerHint: string; expected: ExpectedReceipt } {
  const retailer = rng.pick(RETAILERS);
  const k = rng.int(3, 12);
  const items = rng.sample(GROCERY_ITEMS, k);
  const priceOf = () => rng.int(99, 1999); // cents
  const lines: string[] = [`${retailer.replace(/_/g, " ").toUpperCase()} — Order Summary`];
  let subtotal = 0;
  for (const it of items) {
    const cents = priceOf();
    subtotal += cents;
    lines.push(`${it.line}${" ".repeat(Math.max(2, 44 - it.line.length))}$${(cents / 100).toFixed(2)}`);
  }
  // Sprinkle noise the extractor must ignore (does not affect the recall-only expected item set).
  if (rng.next() < 0.6) lines.splice(rng.int(1, lines.length), 0, rng.pick(NOISE_LINES));
  lines.push(`Subtotal: $${(subtotal / 100).toFixed(2)}`);
  return {
    name: `fuzz:receipt-${i}-${retailer}-${k}items`,
    text: lines.join("\n"),
    retailerHint: retailer,
    // Recall-only (totalCents omitted): synthetic exact-total reconciliation is brittle and not the
    // point — item recall + retailer are the honest, stable signal here.
    expected: { retailer, itemNames: items.map((x) => x.name) },
  };
}

/** `n` deterministic synthetic receipts, self-labelled for genuine recall grading. */
export function syntheticReceipts(
  n: number,
  seed = 1337,
): { name: string; text: string; retailerHint: string; expected: ExpectedReceipt }[] {
  const rng = makeRng(seed);
  return Array.from({ length: n }, (_, i) => synthReceipt(rng, i));
}

// ── Recipe fuzz ─────────────────────────────────────────────────────────────────────────────────

const RECIPE_INGREDIENTS: readonly string[] = [
  "olive oil", "garlic", "onion", "chicken thighs", "soy sauce", "ginger", "carrots", "bell pepper",
  "cumin", "paprika", "black beans", "rice", "lime", "cilantro", "parmesan", "spaghetti", "basil",
  "tomatoes", "mozzarella", "spinach", "chickpeas", "coconut milk", "curry powder", "lemon", "butter",
];

const DISH_ADJ = ["Weeknight", "One-Pan", "Spicy", "Creamy", "Roasted", "Quick", "Hearty", "Simple"];
const DISH_NOUN = ["Chicken Bowl", "Veggie Stir-Fry", "Bean Chili", "Tomato Pasta", "Curry", "Fried Rice", "Traybake"];

function synthRecipe(rng: Rng, i: number): { name: string; text: string; expected: ExpectedRecipe } {
  const title = `${rng.pick(DISH_ADJ)} ${rng.pick(DISH_NOUN)}`;
  const nIng = rng.int(4, 10);
  const ingredients = rng.sample(RECIPE_INGREDIENTS, nIng);
  const nSteps = rng.int(3, 6);
  const lines = [
    title,
    "",
    "Ingredients:",
    ...ingredients.map((g) => `- ${rng.int(1, 3)} ${rng.pick(["cup", "tbsp", "clove", "lb", "oz"])} ${g}`),
    "",
    "Instructions:",
    ...Array.from({ length: nSteps }, (_, s) => `${s + 1}. ${rng.pick(["Heat", "Add", "Stir in", "Simmer", "Season", "Serve"])} the ${rng.pick(ingredients)}.`),
  ];
  return {
    name: `fuzz:recipe-${i}-${nIng}ing-${nSteps}steps`,
    text: lines.join("\n"),
    expected: { title, ingredientNames: ingredients, minSteps: Math.min(3, nSteps) },
  };
}

/** `n` deterministic synthetic recipes, self-labelled for genuine grading. */
export function syntheticRecipes(n: number, seed = 4242): { name: string; text: string; expected: ExpectedRecipe }[] {
  const rng = makeRng(seed);
  return Array.from({ length: n }, (_, i) => synthRecipe(rng, i));
}
