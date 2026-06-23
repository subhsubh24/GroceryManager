"use server";
import { revalidatePath } from "next/cache";
import { loadEnv } from "@gm/config/env";
import { getDb, withTenant } from "@gm/db";
import { logCook } from "@gm/core/recipe/log-cook";
import { estimateMealMacros } from "@gm/core/nutrition";
import { GeminiClient } from "@gm/core/llm";
import { currentUserId } from "@/app/lib/tenant";
import { isPersistedRecipeId, loadRecipeAnySource } from "@/app/lib/recipe";

export interface CookedResult {
  ok: boolean;
  decremented: number;
  error?: string;
}

/**
 * One-tap "I cooked this" — logs the meal, draws down the ingredients used (consume_recipe), and
 * learns the cuisine (PLAN §7.2/§8.7). Shared by the recipe cards' "Cooked it" button and the cook
 * page. Returns a result (no redirect) so the caller can show inline feedback; revalidates the
 * surfaces that change. Macros are computed OUTSIDE the tenant tx (network) and are best-effort.
 */
export async function logCookedRecipe(id: string, servings = 1): Promise<CookedResult> {
  if (!id) return { ok: false, decremented: 0, error: "no recipe" };
  const userId = await currentUserId();
  if (!userId) return { ok: false, decremented: 0, error: "signed out" };
  try {
    const recipe = await loadRecipeAnySource(id);
    if (!recipe) return { ok: false, decremented: 0, error: "not found" };
    const servingsMade = Number.isFinite(servings) && servings > 0 ? servings : 1;

    const env = loadEnv();
    const llm = env.GEMINI_API_KEY || env.GOOGLE_VERTEX_PROJECT ? new GeminiClient(env) : null;
    const macros = await estimateMealMacros(recipe.ingredients, servingsMade, {
      fdcApiKey: env.FDC_API_KEY,
      llm,
    }).catch(() => undefined);

    const res = await withTenant(getDb(), userId, (tx) =>
      logCook(
        tx,
        userId,
        {
          recipeId: isPersistedRecipeId(id) ? id : undefined,
          externalId: recipe.id,
          title: recipe.title,
          imageUrl: recipe.imageUrl,
          cuisine: recipe.cuisine,
          ingredients: recipe.ingredients,
        },
        { servingsMade, macros },
      ),
    );

    // Everything the cook touches: pantry draws down, home autopilot + recipe ranking shift.
    revalidatePath("/pantry");
    revalidatePath("/recipes");
    revalidatePath("/");
    return { ok: true, decremented: res.decremented };
  } catch (e) {
    return { ok: false, decremented: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
