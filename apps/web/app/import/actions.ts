"use server";

import { getDb, getPantryView, withTenant } from "@gm/db";
import { buildPantryIndex, splitSteps } from "@gm/core/recipe";
import { cleanIngredientName, importRecipe } from "@gm/core/recipe/import-llm";
import { currentUserId } from "@/app/lib/tenant";
import type { ImportState } from "./import-recipe";

/**
 * Import a recipe from a URL or pasted text (JSON-LD first, Gemini fallback) and match it against
 * what's on hand. Pantry match is a best-effort bonus — failures there never block the import.
 */
export async function importRecipeAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const url = String(formData.get("url") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!url && !text) return { status: "idle" };

  try {
    const { recipe, method } = await importRecipe(url ? { url } : { text });
    if (recipe.ingredients.length === 0 && !recipe.instructions) {
      return { status: "error", message: "Couldn't find a recipe there — try pasting the text instead." };
    }

    // Match ingredients to in-stock pantry items (skip silently if there's no user/pantry/DB).
    let has: (name: string) => boolean = () => false;
    try {
      const userId = await currentUserId();
      if (userId) {
        const pantry = await withTenant(getDb(), userId, (tx) => getPantryView(tx, userId));
        const inStock = pantry.filter((p) => p.status === "in_stock" || p.status === "low");
        const idx = buildPantryIndex(
          inStock.map((p) => ({ name: p.name, aliases: p.aliases ?? [], inStock: true })),
        );
        has = (n) => idx.has(n);
      }
    } catch {
      // Pantry match is a bonus; ignore DB/auth errors and show the recipe anyway.
    }

    const ingredients = recipe.ingredients.map((i) => ({
      name: i.name,
      measure: i.measure,
      inPantry: has(i.name),
    }));
    // Cleaned, de-duped food names for the "add missing to list" action.
    const missing = Array.from(
      new Set(
        ingredients
          .filter((i) => !i.inPantry)
          .map((i) => cleanIngredientName(i.name))
          .filter(Boolean),
      ),
    );

    return {
      status: "done",
      method: method === "json-ld" ? "page data" : "AI",
      title: recipe.title,
      imageUrl: recipe.imageUrl,
      servings: recipe.servings,
      sourceUrl: recipe.sourceUrl,
      steps: splitSteps(recipe.instructions),
      ingredients,
      missing,
      haveCount: ingredients.filter((i) => i.inPantry).length,
      totalCount: ingredients.length,
    };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
