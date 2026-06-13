/**
 * Recipe provider abstraction (PLAN §7.2). The app depends on the interface; adapters are
 * swappable. TheMealDBProvider is the free, no-key fallback; a Spoonacular adapter (key + native
 * find-by-ingredients) slots in behind the same interface later.
 */
export interface ProviderRecipe {
  id: string;
  title: string;
  imageUrl?: string;
  sourceUrl?: string;
  ingredients: { name: string }[];
}

export interface RecipeProvider {
  /** Lightweight candidates for a single ingredient (ingredients may be unpopulated). */
  searchByIngredient(ingredient: string): Promise<ProviderRecipe[]>;
  /** Full recipe incl. ingredient list. */
  getById(id: string): Promise<ProviderRecipe | null>;
}

/** Pure: map a TheMealDB "meal" object → our ProviderRecipe (strIngredient1..20). */
export function mapMealDbMeal(meal: Record<string, unknown>): ProviderRecipe {
  const ingredients: { name: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const raw = meal[`strIngredient${i}`];
    const name = typeof raw === "string" ? raw.trim() : "";
    if (name) ingredients.push({ name });
  }
  return {
    id: String(meal.idMeal ?? ""),
    title: String(meal.strMeal ?? ""),
    imageUrl: typeof meal.strMealThumb === "string" ? meal.strMealThumb : undefined,
    sourceUrl: typeof meal.strSource === "string" ? meal.strSource : undefined,
    ingredients,
  };
}

export class TheMealDBProvider implements RecipeProvider {
  constructor(private readonly base = "https://www.themealdb.com/api/json/v1/1") {}

  async searchByIngredient(ingredient: string): Promise<ProviderRecipe[]> {
    const res = await fetch(`${this.base}/filter.php?i=${encodeURIComponent(ingredient)}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { meals: Record<string, unknown>[] | null };
    return (json.meals ?? []).map((m) => ({
      id: String(m.idMeal ?? ""),
      title: String(m.strMeal ?? ""),
      imageUrl: typeof m.strMealThumb === "string" ? m.strMealThumb : undefined,
      ingredients: [], // filter.php is lightweight; call getById for the full list
    }));
  }

  async getById(id: string): Promise<ProviderRecipe | null> {
    const res = await fetch(`${this.base}/lookup.php?i=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { meals: Record<string, unknown>[] | null };
    const meal = json.meals?.[0];
    return meal ? mapMealDbMeal(meal) : null;
  }
}
