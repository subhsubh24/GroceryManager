"use server";
import { revalidatePath } from "next/cache";
import { loadEnv } from "@gm/config/env";
import { getDb, loadPreferenceSignals, withTenant } from "@gm/db";
import { logCook } from "@gm/core/recipe/log-cook";
import { estimateMealMacros } from "@gm/core/nutrition";
import { GeminiClient } from "@gm/core/llm";
import { isPremium } from "@gm/core/billing";
import { currentUserId } from "@/app/lib/tenant";
import { checkLlmQuota } from "@/app/api/_lib/llm-quota";
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
    // Best-effort macros. When the LLM would run (a key is configured), charge a slot from the
    // per-user daily AI quota FIRST (G7 spend ceiling) — mirrors the mobile cook route + plan/remix.
    // logCookedRecipe has no rate limit, so without this an authed user could spend un-metered Gemini
    // macro calls past the 10-free/100-premium daily cap (a paid-API drain). On exhaustion, degrade to
    // keyless FDC-only macros rather than blocking the core "I cooked this" pantry-drawdown write.
    let llm: GeminiClient | null = null;
    if (env.GEMINI_API_KEY || env.GOOGLE_VERTEX_PROJECT) {
      const signals = await withTenant(getDb(), userId, (tx) => loadPreferenceSignals(tx, userId));
      if (checkLlmQuota(userId, isPremium(signals)).allowed) llm = new GeminiClient(env);
    }
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
