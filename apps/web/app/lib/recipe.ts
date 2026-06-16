import { getDb, loadRecipeForCook } from "@gm/db";
import { TheMealDBProvider } from "@gm/core/recipe";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CookableRecipe {
  id: string;
  title: string;
  imageUrl?: string;
  instructions?: string;
  sourceUrl?: string;
  cuisine?: string;
  ingredients: { name: string; measure?: string }[];
}

/** True for a persisted (imported/saved) recipe id vs. a TheMealDB numeric id. */
export const isPersistedRecipeId = (id: string) => UUID.test(id);

/**
 * Load a recipe for Cook Mode / share pages from either source: a persisted (imported) recipe by
 * uuid, or a TheMealDB recipe by its numeric id. Recipes are a shared catalog (no RLS), so no tenant.
 */
export async function loadRecipeAnySource(id: string): Promise<CookableRecipe | null> {
  if (isPersistedRecipeId(id)) {
    return (await loadRecipeForCook(getDb(), id)) ?? null;
  }
  return (await new TheMealDBProvider().getById(id)) ?? null;
}
