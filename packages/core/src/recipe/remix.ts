/**
 * Recipe Remix (additive feature) — one-tap transform a recipe along an axis (healthier / cheaper /
 * faster / vegan) into ingredient swaps + a short note. This file is the deterministic floor: a
 * curated per-axis table is the instant, no-key fallback (mirrors substitute.ts). The LLM enriches
 * the long tail behind a separate server-only entry (remix-llm.ts) so this stays client-safe.
 *
 * Essentially axis-driven substitutions over a whole recipe: each ingredient name is matched
 * (case-insensitive, token/substring) against the axis table and turned into a swap.
 */
export type RemixAxis = "healthier" | "cheaper" | "faster" | "vegan";

export type RemixSwap = {
  /** The recipe ingredient we matched (as written by the recipe, trimmed). */
  original: string;
  /** What to use instead. */
  replacement: string;
  /** Why — a short home-cook-friendly rationale. */
  reason: string;
};

export type RemixResult = {
  axis: RemixAxis;
  source: "table" | "llm";
  swaps: RemixSwap[];
  note: string;
};

export const REMIX_AXES: readonly RemixAxis[] = ["healthier", "cheaper", "faster", "vegan"];

/** Narrow an arbitrary string to a RemixAxis (default "healthier"). */
export function parseAxis(value: string | null | undefined): RemixAxis {
  const v = (value ?? "").toLowerCase().trim();
  return (REMIX_AXES as readonly string[]).includes(v) ? (v as RemixAxis) : "healthier";
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const singular = (t: string) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t);
const tokens = (s: string) => norm(s).split(" ").map(singular).filter((t) => t.length > 1);

/** One entry in an axis table: a keyword (matched against the ingredient) → swap. */
interface AxisRule {
  keyword: string;
  replacement: string;
  reason: string;
}

// Curated per-axis swap tables. Keys are common ingredient keywords; matching is token-based
// (so "boneless chicken breast" matches "chicken"). Longer (more specific) keys win.
const TABLES: Record<RemixAxis, AxisRule[]> = {
  vegan: [
    { keyword: "butter", replacement: "olive oil or vegan butter", reason: "Removes dairy; keeps the fat for richness." },
    { keyword: "milk", replacement: "oat milk", reason: "Plant milk swaps 1:1 for dairy milk." },
    { keyword: "heavy cream", replacement: "coconut cream", reason: "Coconut cream brings the same body without dairy." },
    { keyword: "cream", replacement: "coconut cream", reason: "Coconut cream brings the same body without dairy." },
    { keyword: "cheese", replacement: "vegan cheese or nutritional yeast", reason: "Nutritional yeast adds a savory, cheesy note." },
    { keyword: "egg", replacement: "flax egg (1 tbsp ground flaxseed + 3 tbsp water)", reason: "Binds like an egg in most batters." },
    { keyword: "chicken", replacement: "tofu or chickpeas", reason: "A plant protein that takes on the same seasoning." },
    { keyword: "beef", replacement: "tempeh or lentils", reason: "Hearty plant protein in place of red meat." },
    { keyword: "pork", replacement: "tempeh or mushrooms", reason: "Umami-rich plant swap for pork." },
    { keyword: "bacon", replacement: "smoked tempeh or coconut bacon", reason: "Keeps the smoky, salty hit, no pork." },
    { keyword: "fish", replacement: "hearts of palm or tofu", reason: "Flaky, mild plant stand-in for fish." },
    { keyword: "shrimp", replacement: "hearts of palm or king oyster mushroom", reason: "Mimics the bite of shrimp." },
    { keyword: "honey", replacement: "maple syrup", reason: "A plant-based liquid sweetener." },
    { keyword: "yogurt", replacement: "coconut yogurt", reason: "Dairy-free yogurt with the same tang." },
    { keyword: "gelatin", replacement: "agar-agar", reason: "Plant-based setting agent." },
  ],
  healthier: [
    { keyword: "butter", replacement: "olive oil", reason: "Swaps saturated for heart-healthy unsaturated fat." },
    { keyword: "sour cream", replacement: "Greek yogurt", reason: "Same tang, more protein and less fat." },
    { keyword: "heavy cream", replacement: "Greek yogurt", reason: "Cuts the fat while keeping it creamy." },
    { keyword: "cream", replacement: "Greek yogurt", reason: "Cuts the fat while keeping it creamy." },
    { keyword: "mayonnaise", replacement: "Greek yogurt", reason: "Lighter, higher-protein creamy base." },
    { keyword: "mayo", replacement: "Greek yogurt", reason: "Lighter, higher-protein creamy base." },
    { keyword: "white rice", replacement: "brown rice or quinoa", reason: "More fiber and a lower glycemic load." },
    { keyword: "white pasta", replacement: "whole-wheat pasta", reason: "More fiber than refined pasta." },
    { keyword: "pasta", replacement: "whole-wheat pasta", reason: "More fiber than refined pasta." },
    { keyword: "ground beef", replacement: "ground turkey", reason: "Leaner protein, less saturated fat." },
    { keyword: "sugar", replacement: "honey (use less)", reason: "Naturally sweeter, so you can use a bit less." },
    { keyword: "salt", replacement: "herbs, lemon, or spices", reason: "Flavor without the extra sodium." },
  ],
  cheaper: [
    { keyword: "salmon", replacement: "canned tuna", reason: "Same omega-rich fish for a fraction of the price." },
    { keyword: "shrimp", replacement: "eggs or white beans", reason: "Cheap protein that still carries the dish." },
    { keyword: "pine nuts", replacement: "sunflower seeds", reason: "Same toasty crunch, far less cost." },
    { keyword: "beef", replacement: "chicken thighs or lentils", reason: "Budget protein in place of pricey beef." },
    { keyword: "saffron", replacement: "turmeric", reason: "Gives the golden color for pennies." },
    { keyword: "fresh herbs", replacement: "dried herbs", reason: "Use about a third as much; far cheaper and keeps longer." },
    { keyword: "parmesan", replacement: "grana padano", reason: "Very similar hard cheese, lower price." },
    { keyword: "almonds", replacement: "peanuts", reason: "Cheaper nut with the same role." },
  ],
  faster: [
    { keyword: "dried beans", replacement: "canned beans", reason: "Skip the overnight soak and long simmer." },
    { keyword: "whole spices", replacement: "ground spices", reason: "No toasting or grinding step." },
    { keyword: "chicken breast", replacement: "rotisserie chicken", reason: "Already cooked — just shred and add." },
    { keyword: "raw chicken", replacement: "rotisserie chicken", reason: "Already cooked — just shred and add." },
    { keyword: "rice", replacement: "instant rice", reason: "Ready in a few minutes instead of 20+." },
    { keyword: "tomato sauce", replacement: "jarred marinara", reason: "Skip building a sauce from scratch." },
    { keyword: "marinara", replacement: "jarred marinara", reason: "Skip building a sauce from scratch." },
    { keyword: "garlic", replacement: "jarred minced garlic", reason: "No peeling or mincing." },
  ],
};

// Per-axis generic note shown even when there are no swaps.
const NOTES: Record<RemixAxis, string> = {
  vegan: "Swapped animal products for plant-based stand-ins — adjust seasoning to taste.",
  healthier: "Lighter swaps that keep the dish satisfying — trade refined and high-fat items for whole-food options.",
  cheaper: "Budget-friendly swaps that keep the dish recognizable — fancy items go, flavor stays.",
  faster: "Shortcut swaps that cut prep and cook time — reach for pantry and ready-made versions.",
};

// Pre-tokenize each rule once, longest (most specific) key first so "white rice" beats "rice".
const RULES: Record<RemixAxis, { rule: AxisRule; toks: string[] }[]> = Object.fromEntries(
  (REMIX_AXES as readonly RemixAxis[]).map((axis) => [
    axis,
    TABLES[axis]
      .map((rule) => ({ rule, toks: tokens(rule.keyword) }))
      .sort((a, b) => b.toks.length - a.toks.length),
  ]),
) as Record<RemixAxis, { rule: AxisRule; toks: string[] }[]>;

/** First matching rule for an ingredient on this axis, or null. Token-subset match, specific first. */
function matchRule(ingredient: string, axis: RemixAxis): AxisRule | null {
  const it = new Set(tokens(ingredient));
  if (it.size === 0) return null;
  for (const { rule, toks } of RULES[axis]) {
    if (toks.length && toks.every((t) => it.has(t))) return rule;
  }
  return null;
}

/**
 * Deterministic remix: match each ingredient against the axis table and collect swaps. Deduped by
 * `original` (the first match for a given ingredient wins). Always returns the per-axis note; no
 * matches → empty swaps + note. `source: "table"`.
 */
export function remixFromTable(ingredients: string[], axis: RemixAxis): RemixResult {
  const swaps: RemixSwap[] = [];
  const seen = new Set<string>();
  for (const raw of ingredients) {
    const original = (raw ?? "").trim();
    if (!original) continue;
    const key = norm(original);
    if (seen.has(key)) continue;
    const rule = matchRule(original, axis);
    if (!rule) continue;
    seen.add(key);
    swaps.push({ original, replacement: rule.replacement, reason: rule.reason });
  }
  return { axis, source: "table", swaps, note: NOTES[axis] };
}
