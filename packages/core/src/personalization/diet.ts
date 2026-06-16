/**
 * Diet → excluded-ingredient mapping (PLAN §7.2 diet filtering + §10 guest mode). Pure + tested.
 *
 * reciperanking hard-excludes recipes containing any "allergen" keyword (rankRecipes), but diets
 * (vegan/gluten-free/…) were produced by projectUserModel and never enforced. This turns a diet
 * into the ingredient keywords it forbids, so a diet (yours, or a guest's tonight) actually filters
 * the recipe list. Keywords are matched by the same tokenizer rankRecipes uses.
 */
const DIET_EXCLUSIONS: Record<string, string[]> = {
  vegan: [
    "beef", "chicken", "pork", "lamb", "turkey", "fish", "salmon", "tuna", "shrimp", "prawn",
    "seafood", "bacon", "ham", "egg", "milk", "cheese", "butter", "cream", "yogurt", "honey", "gelatin",
  ],
  vegetarian: [
    "beef", "chicken", "pork", "lamb", "turkey", "fish", "salmon", "tuna", "shrimp", "prawn",
    "seafood", "bacon", "ham", "gelatin", "anchovy",
  ],
  pescatarian: ["beef", "chicken", "pork", "lamb", "turkey", "bacon", "ham"],
  "gluten-free": ["wheat", "flour", "bread", "pasta", "barley", "rye", "couscous", "breadcrumb", "noodle"],
  "dairy-free": ["milk", "cheese", "butter", "cream", "yogurt", "buttermilk"],
  keto: ["sugar", "bread", "pasta", "rice", "potato", "flour"],
  halal: ["pork", "bacon", "ham", "lard"],
  kosher: ["pork", "bacon", "ham", "shellfish", "shrimp", "crab", "lobster"],
};

/** Known diet keys (for validating UI input). */
export const KNOWN_DIETS = Object.keys(DIET_EXCLUSIONS);

/** Union of ingredient keywords forbidden by the given diets (deduped, lowercased). */
export function dietExclusions(diets: string[]): string[] {
  const out = new Set<string>();
  for (const d of diets) {
    for (const x of DIET_EXCLUSIONS[d.toLowerCase().trim()] ?? []) out.add(x);
  }
  return [...out];
}
