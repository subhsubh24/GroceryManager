/**
 * Ingredient substitutions (PLAN §10 "no buttermilk → milk + lemon"). Pure + tested. A curated
 * table of common cooking swaps is the deterministic floor (instant, no key); the LLM handles the
 * long tail behind a separate server-only entry (substitute-llm.ts) so this stays client-safe.
 */
export interface Substitution {
  /** Concise swap with amounts/ratios. */
  text: string;
  /** Ingredient names the swap relies on (for future pantry-aware filtering). */
  uses?: string[];
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const singular = (t: string) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t);
const tokens = (s: string) => norm(s).split(" ").map(singular).filter((t) => t.length > 1);

const TABLE: Record<string, Substitution[]> = {
  buttermilk: [
    { text: "1 cup milk + 1 tbsp lemon juice or vinegar — rest 5 min", uses: ["milk", "lemon juice"] },
    { text: "¾ cup plain yogurt thinned with milk", uses: ["yogurt", "milk"] },
  ],
  egg: [
    { text: "1 tbsp ground flaxseed + 3 tbsp water (baking)", uses: ["flaxseed"] },
    { text: "¼ cup unsweetened applesauce (baking)", uses: ["applesauce"] },
  ],
  butter: [
    { text: "Equal oil (¾ the amount for liquid oils)", uses: ["oil"] },
    { text: "Equal margarine", uses: ["margarine"] },
  ],
  "heavy cream": [{ text: "¾ cup milk + ¼ cup melted butter", uses: ["milk", "butter"] }],
  "sour cream": [{ text: "Equal plain Greek yogurt", uses: ["greek yogurt"] }],
  "self rising flour": [
    { text: "1 cup flour + 1½ tsp baking powder + ¼ tsp salt", uses: ["flour", "baking powder", "salt"] },
  ],
  "brown sugar": [{ text: "1 cup white sugar + 1 tbsp molasses", uses: ["sugar", "molasses"] }],
  honey: [{ text: "1¼ cup sugar + ¼ cup extra liquid, or equal maple syrup", uses: ["sugar", "maple syrup"] }],
  garlic: [{ text: "⅛ tsp garlic powder per clove", uses: ["garlic powder"] }],
  cornstarch: [{ text: "2 tbsp flour per 1 tbsp cornstarch (to thicken)", uses: ["flour"] }],
  "white wine": [{ text: "Equal broth + 1 tsp vinegar or lemon", uses: ["broth", "vinegar"] }],
  "red wine": [{ text: "Equal broth + 1 tsp vinegar", uses: ["broth", "vinegar"] }],
  "lemon juice": [{ text: "Equal lime juice, or ½ as much vinegar", uses: ["lime juice", "vinegar"] }],
  milk: [{ text: "Equal plant milk, or ½ cup cream + ½ cup water per cup", uses: ["plant milk", "cream"] }],
  "baking powder": [{ text: "¼ tsp baking soda + ½ tsp cream of tartar per 1 tsp", uses: ["baking soda", "cream of tartar"] }],
  mayonnaise: [{ text: "Equal plain Greek yogurt", uses: ["greek yogurt"] }],
  breadcrumbs: [{ text: "Equal crushed crackers, or rolled oats", uses: ["crackers", "oats"] }],
};

// Pre-tokenize keys once, longest (most specific) first so "self rising flour" beats "flour".
const KEYS = Object.keys(TABLE)
  .map((key) => ({ key, toks: tokens(key) }))
  .sort((a, b) => b.toks.length - a.toks.length);

/** Look up known substitutions for an ingredient name. Returns [] when none are known. */
export function findSubstitutions(ingredient: string): Substitution[] {
  const it = new Set(tokens(ingredient));
  if (it.size === 0) return [];
  for (const { key, toks } of KEYS) {
    if (toks.length && toks.every((t) => it.has(t))) return TABLE[key]!;
  }
  return [];
}
