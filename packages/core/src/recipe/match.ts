/**
 * "Cook what I have" matching + ranking (PLAN §7.2). Pure + testable.
 *
 * Split: build a pantry index → annotate a recipe's ingredients (in-pantry? expiring?) →
 * rank by coverage, sufficiency-ish, missing count, expiring-soon boost, and (on low-energy
 * days) effort/cleanup fit (§7.4). The provider adapter feeds raw recipes in.
 */

// Plant-based ingredient token sets: compounds that share a word with a dairy/animal allergen keyword
// but are categorically different (e.g. "peanut butter" has "butter" but contains no dairy).
// Token-subset matched: any entry whose tokens are a subset of the ingredient's tokens triggers
// the exemption. This handles qualifiers in real recipe strings ("2 tbsp peanut butter" → still exempt).
const PLANT_BASED_COMPOUND_TOKENS: string[][] = [
  // Nut & seed butters
  ["peanut", "butter"], ["almond", "butter"], ["cashew", "butter"], ["sunflower", "butter"],
  ["sunflower", "seed", "butter"], ["hazelnut", "butter"], ["walnut", "butter"],
  ["pecan", "butter"], ["macadamia", "butter"], ["coconut", "butter"],
  ["nut", "butter"], ["seed", "butter"],
  // Fruit "butters" (no dairy)
  ["apple", "butter"], ["pumpkin", "butter"],
  // Cocoa-derived (no dairy)
  ["cocoa", "butter"],
  // Plant milks
  ["almond", "milk"], ["oat", "milk"], ["soy", "milk"], ["coconut", "milk"], ["rice", "milk"],
  ["cashew", "milk"], ["hemp", "milk"], ["flax", "milk"], ["hazelnut", "milk"], ["pea", "milk"],
  // Plant creams
  ["oat", "cream"], ["coconut", "cream"], ["cashew", "cream"], ["soy", "cream"],
].map((compound) => compound.map(singular));

/** Returns true when the ingredient's tokens include a known plant-based compound (e.g. "peanut butter"). */
function isPlantBasedCompound(ingredientName: string): boolean {
  const it = new Set(tokens(ingredientName));
  return PLANT_BASED_COMPOUND_TOKENS.some((cand) => cand.every((t) => it.has(t)));
}

const STOPWORDS = new Set([
  "fresh", "chopped", "minced", "diced", "sliced", "large", "small", "medium", "organic",
  "ground", "grated", "to", "taste", "of", "a", "an", "the", "and", "or", "with",
  "cup", "cups", "tbsp", "tsp", "tablespoon", "tablespoons", "teaspoon", "teaspoons",
  "oz", "ounce", "ounces", "gram", "grams", "kg", "ml", "lb", "lbs", "pound", "pounds",
  "clove", "can", "cans", "package", "pkg", "boneless", "skinless", "extra", "virgin",
  "ripe", "frozen", "dried", "raw", "cooked", "optional", "pinch", "dash", "for", "into",
]);

export function normalizeIngredientName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singular(t: string): string {
  return t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t;
}

function tokens(s: string): string[] {
  return normalizeIngredientName(s)
    .split(" ")
    .map(singular)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

export interface PantryEntry {
  name: string;
  aliases?: string[];
  inStock?: boolean;
  expiringSoon?: boolean;
}

export interface PantryIndex {
  has(ingredient: string): boolean;
  expiring(ingredient: string): boolean;
}

/** Build a matcher from in-stock pantry items (names + aliases). */
export function buildPantryIndex(items: PantryEntry[]): PantryIndex {
  const entries = items
    .filter((i) => i.inStock !== false)
    .map((i) => ({
      expiring: Boolean(i.expiringSoon),
      candidateTokenSets: [i.name, ...(i.aliases ?? [])]
        .map(tokens)
        .filter((ts) => ts.length > 0),
    }));

  function match(ingredient: string): (typeof entries)[number] | null {
    const it = new Set(tokens(ingredient));
    if (it.size === 0) return null;
    for (const e of entries) {
      for (const cand of e.candidateTokenSets) {
        if (cand.every((t) => it.has(t))) return e; // pantry name/alias ⊆ ingredient tokens
      }
    }
    return null;
  }

  return {
    has: (ing) => match(ing) !== null,
    expiring: (ing) => match(ing)?.expiring ?? false,
  };
}

export interface RawRecipe {
  id: string;
  title: string;
  ingredients: { name: string; isOptional?: boolean }[];
  readyMinutes?: number | null;
  effortScore?: number | null; // 0..1, lower = easier
  batchScore?: number | null; // 0..1, higher = keeps/reheats/scales better (§10 batch-cook)
  cuisine?: string;
}

export interface MatchRecipe extends RawRecipe {
  ingredients: (RawRecipe["ingredients"][number] & { inPantry: boolean; expiringSoon: boolean })[];
}

export function annotateRecipe(recipe: RawRecipe, idx: PantryIndex): MatchRecipe {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((g) => ({
      ...g,
      inPantry: idx.has(g.name),
      expiringSoon: idx.expiring(g.name),
    })),
  };
}

export interface RankedRecipe {
  id: string;
  title: string;
  coverage: number;
  haveCount: number;
  totalCore: number;
  missing: string[];
  usesExpiring: number;
  batchFriendly: boolean;
  score: number;
}

interface Weights {
  coverage: number;
  missing: number;
  expiring: number;
  effort: number;
  batch: number;
  love: number;
  dislike: number;
  cuisine: number;
}
const DEFAULT_WEIGHTS: Weights = {
  coverage: 1,
  missing: 0.15,
  expiring: 0.3,
  effort: 0.4,
  batch: 0.5,
  love: 0.25,
  dislike: 0.5,
  cuisine: 0.3,
};

/** Personalization inputs from the projected UserModel (§8.7). */
export interface RankPrefs {
  allergens?: string[]; // true allergens: hard-exclude using subset token matching
  /**
   * Diet-derived ingredient keywords (from dietExclusions). Matched with the same token-subset
   * logic as allergens, but plant-based compounds (e.g. "peanut butter", "almond milk") are
   * exempted so they never wrongly suppress vegan/dairy-free results.
   */
  dietKeywords?: string[];
  dislikes?: string[]; // ingredient names / "cuisine:x" keys to penalize
  loves?: string[]; // ingredient names / "cuisine:x" keys to boost
  cuisineAffinity?: Record<string, number>; // cuisine (lowercase) -> -1..1
}

export interface RankOpts {
  /** Busy/low-energy: up-weight low-effort recipes (§7.4). */
  lowEnergy?: boolean;
  /** Meal-prep: up-weight dishes that keep/reheat/scale well (§10 batch-cook). */
  batchCook?: boolean;
  weights?: Partial<Weights>;
  limit?: number;
  prefs?: RankPrefs;
}

const stripCuisineKeys = (keys: string[] | undefined) =>
  (keys ?? []).filter((k) => !k.startsWith("cuisine:"));

export function rankRecipes(recipes: MatchRecipe[], opts: RankOpts = {}): RankedRecipe[] {
  const w: Weights = { ...DEFAULT_WEIGHTS, ...opts.weights };
  const p = opts.prefs;
  const allergenIdx = p?.allergens?.length ? buildPantryIndex(p.allergens.map((a) => ({ name: a }))) : null;
  const dietIdx = p?.dietKeywords?.length ? buildPantryIndex(p.dietKeywords.map((k) => ({ name: k }))) : null;
  const loveNames = stripCuisineKeys(p?.loves);
  const dislikeNames = stripCuisineKeys(p?.dislikes);
  const loveIdx = loveNames.length ? buildPantryIndex(loveNames.map((n) => ({ name: n }))) : null;
  const dislikeIdx = dislikeNames.length ? buildPantryIndex(dislikeNames.map((n) => ({ name: n }))) : null;

  const ranked = recipes
    .filter((r) => {
      if (allergenIdx && r.ingredients.some((i) => allergenIdx.has(i.name))) return false;
      if (dietIdx && r.ingredients.some((i) => !isPlantBasedCompound(i.name) && dietIdx.has(i.name))) return false;
      return true;
    })
    .map((r) => {
      const core = r.ingredients.filter((i) => !i.isOptional);
      const have = core.filter((i) => i.inPantry);
      const coverage = core.length ? have.length / core.length : 0;
      const missing = core.filter((i) => !i.inPantry).map((i) => i.name);
      const usesExpiring = r.ingredients.filter((i) => i.inPantry && i.expiringSoon).length;
      const effortFit = r.effortScore != null ? 1 - r.effortScore : 0.5;
      const batchFit = r.batchScore ?? 0.5;

      const loveMatches = loveIdx ? r.ingredients.filter((i) => loveIdx.has(i.name)).length : 0;
      const dislikeMatches = dislikeIdx ? r.ingredients.filter((i) => dislikeIdx.has(i.name)).length : 0;
      const cuisineAffinity =
        p?.cuisineAffinity && r.cuisine ? (p.cuisineAffinity[r.cuisine.toLowerCase()] ?? 0) : 0;

      let score =
        w.coverage * coverage +
        w.expiring * Math.min(1, usesExpiring * 0.5) -
        w.missing * missing.length +
        w.love * Math.min(1, loveMatches * 0.5) -
        w.dislike * dislikeMatches +
        w.cuisine * cuisineAffinity;
      if (opts.lowEnergy) score += w.effort * effortFit;
      if (opts.batchCook) score += w.batch * batchFit;

      return {
        id: r.id,
        title: r.title,
        coverage,
        haveCount: have.length,
        totalCore: core.length,
        missing,
        usesExpiring,
        batchFriendly: batchFit >= 0.6,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
  return opts.limit ? ranked.slice(0, opts.limit) : ranked;
}
