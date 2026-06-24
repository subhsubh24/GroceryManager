"use server";

import { redirect } from "next/navigation";
import { loadEnv } from "@gm/config/env";
import { getDb, getPantryView, saveImportedRecipe, withTenant } from "@gm/db";
import { buildPantryIndex, splitSteps } from "@gm/core/recipe";
import { cleanIngredientName, importRecipe } from "@gm/core/recipe/import-llm";
import { currentUserId } from "@/app/lib/tenant";
import type { ImportState } from "./import-recipe";

/**
 * Import a recipe from a URL, pasted text, or a photo (JSON-LD first for URLs, else Gemini — vision
 * for photos) and match it against what's on hand. Pantry match is a best-effort bonus — failures
 * there never block the import.
 */
export async function importRecipeAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const url = String(formData.get("url") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const imageFile = formData.get("image");
  const hasImage = imageFile instanceof File && imageFile.size > 0;
  if (!url && !text && !hasImage) return { status: "idle" };

  try {
    const env = loadEnv();
    const hasLLM = !!(env.GEMINI_API_KEY || env.GOOGLE_VERTEX_PROJECT);

    let input: Parameters<typeof importRecipe>[0];
    if (url) {
      input = { url };
    } else if (imageFile instanceof File && imageFile.size > 0) {
      if (!hasLLM) {
        return { status: "error", message: "Importing recipes from photos requires Gemini or Google Vertex AI configured." };
      }
      if (imageFile.size > 6 * 1024 * 1024) {
        return { status: "error", message: "That image is too large — keep it under ~6 MB." };
      }
      const buf = Buffer.from(await imageFile.arrayBuffer());
      input = { image: { mimeType: imageFile.type || "image/jpeg", dataBase64: buf.toString("base64") } };
    } else {
      if (!hasLLM) {
        return { status: "error", message: "Importing recipes from text requires Gemini or Google Vertex AI configured." };
      }
      input = { text };
    }

    const { recipe, method } = await importRecipe(input);
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

/**
 * Persist an imported recipe (from the client's parsed result, passed as JSON) to "my recipes" and
 * jump into Cook Mode for it. `redirect` runs after the try/catch (it throws to do its work).
 */
export async function saveImportedRecipeAction(formData: FormData) {
  const raw = String(formData.get("recipe") ?? "");
  let parsed: {
    title?: string;
    imageUrl?: string;
    sourceUrl?: string;
    instructions?: string;
    ingredients?: { name: string; measure?: string }[];
  } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    redirect("/import?error=" + encodeURIComponent("Couldn't read the recipe to save."));
  }
  if (!parsed.title) redirect("/import?error=" + encodeURIComponent("Nothing to save."));

  const id = await saveImportedRecipe(getDb(), {
    title: parsed.title!,
    imageUrl: parsed.imageUrl ?? null,
    sourceUrl: parsed.sourceUrl ?? null,
    instructions: parsed.instructions ?? null,
    ingredients: parsed.ingredients ?? [],
  });
  redirect(`/cook/${id}`);
}
