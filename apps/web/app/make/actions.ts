"use server";

import { loadEnv } from "@gm/config/env";
import { getDb, getPantryView, loadPreferenceSignals, withTenant } from "@gm/db";
import { GeminiClient } from "@gm/core/llm";
import { dietExclusions, projectUserModel } from "@gm/core/personalization";
import { generateMeals, type GeneratedMeal, type MealEnergy } from "@gm/core/recipe/generate-llm";
import { currentUserId } from "@/app/lib/tenant";

export type GenerateResult =
  | { ok: true; meals: GeneratedMeal[] }
  | { ok: false; error: string };

/**
 * Generate meal ideas from the signed-in user's actual pantry, tuned to `energy`. Mirrors the
 * /recipes loader for pantry + taste: in-stock = in_stock|low, expiring = low|expired_likely; taste
 * comes from the projected user model with diet-derived hard excludes folded into the allergen list.
 *
 * Everything that can fail degrades to a friendly `{ ok: false, error }` — no session, empty pantry,
 * no Gemini key, or an LLM/network failure. Raw errors are never leaked to the client. The network
 * call (generateMeals) runs OUTSIDE the DB tx, after the tenant read closes (same shape as cook's
 * logThisCook): only the pantry/signals read is inside withTenant.
 */
export async function generateMealsAction(energy: MealEnergy): Promise<GenerateResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sign in to generate meals." };

  // Pantry + taste signals together in one tenant tx; the LLM call happens after it closes.
  const { pantry, signals } = await withTenant(getDb(), userId, async (tx) => ({
    pantry: await getPantryView(tx, userId),
    signals: await loadPreferenceSignals(tx, userId),
  }));

  const inStock = pantry.filter((p) => p.status === "in_stock" || p.status === "low");
  if (inStock.length === 0) return { ok: false, error: "Your pantry's empty — add items first." };
  const pantryNames = inStock.map((p) => p.name);
  const expiring = inStock
    .filter((p) => p.status === "low" || p.status === "expired_likely")
    .map((p) => p.name);

  const env = loadEnv();
  if (!env.GEMINI_API_KEY && !env.GOOGLE_VERTEX_PROJECT) {
    return { ok: false, error: "AI generation isn't configured." };
  }

  const model = projectUserModel(signals);
  // Enforce the user's own diet as a hard exclude alongside declared allergens (§7.2/§10).
  const exclusions = dietExclusions(model.diets);

  try {
    const meals = await generateMeals(new GeminiClient(env), {
      pantry: pantryNames,
      expiring,
      energy,
      diets: model.diets,
      allergens: [...model.allergens, ...exclusions],
      loves: model.loves,
      dislikes: model.dislikes,
    });
    return { ok: true, meals };
  } catch {
    // Best-effort generation — never surface the raw LLM/network error to the client.
    return { ok: false, error: "Couldn't generate right now — try again." };
  }
}
