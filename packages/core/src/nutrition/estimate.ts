/**
 * Meal-macro estimator (cook-logging with stored macros) — the orchestrator that turns a recipe's
 * ingredients into one stored `MealMacros`. PLAN's "FDC + LLM if data is missing": FoodData Central
 * is PRIMARY (per-ingredient, for cleanly-massable amounts); the LLM is the FALLBACK for whatever FDC
 * can't answer (no key, no gram quantity, or no match), batched into a SINGLE call.
 *
 * Best-effort by contract: this function NEVER throws. Any failure degrades to fewer resolved
 * ingredients — and, in the worst case, to `{ ...zeros, source: "none", confidence: 0 }` — so macro
 * estimation can never block logging a cook.
 *
 * Network lives here (FDC fetch + the Gemini call); the math is in compute.ts.
 */
import { z } from "zod";
import { parseMeasure } from "../recipe/consume.js";
import {
  EMPTY_MACROS,
  addMacros,
  gramsFromMeasure,
  macrosFromPer100g,
  roundMacros,
  scaleMacros,
} from "./compute.js";
import { fetchFdcPer100g } from "./fdc.js";
import type { MacroIngredient, MacroSource, MealMacros } from "./types.js";

/** The LLM returns the COMBINED macros (whole recipe, as written) for the ingredients FDC couldn't do. */
const LlmMacrosSchema = z.object({
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
});

const LLM_SYSTEM =
  "You are a nutrition estimator. Given a list of recipe ingredients with their amounts, estimate the " +
  "COMBINED macros for ALL of them together, for the whole recipe as written (not per serving): total " +
  "calories (kcal) and grams of protein, carbohydrate, and fat. Use typical food composition. Return " +
  "JSON only.";

export interface EstimateDeps {
  /** USDA FoodData Central key. Absent ⇒ FDC is skipped and everything routes to the LLM fallback. */
  fdcApiKey?: string | null;
  /** Gemini client for the fallback. Absent ⇒ no fallback (ingredients FDC can't do are dropped). */
  llm?: import("../llm/client.js").GeminiClient | null;
  /** Injectable fetch for the FDC call (tests). */
  fetchImpl?: typeof fetch;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** One line per ingredient for the LLM prompt, e.g. "- garlic: 2 cloves". */
function ingredientLine(ing: MacroIngredient): string {
  const measure = ing.measure?.trim();
  return measure ? `- ${ing.name}: ${measure}` : `- ${ing.name}`;
}

/**
 * Estimate a cooked meal's macros. `servings` scales the per-recipe base total at the END (matching
 * logCook's servingsScale convention — the stored figure is for everything actually cooked).
 */
export async function estimateMealMacros(
  ingredients: MacroIngredient[],
  servings: number,
  deps: EstimateDeps,
): Promise<MealMacros> {
  try {
    const s = Math.max(1, servings);

    // Base totals are computed for the recipe AS WRITTEN; we scale by servings once at the end.
    let total = EMPTY_MACROS;
    let fdcUsed = false;
    let llmUsed = false;
    let consideredCount = 0;
    let resolvedByFdc = 0;
    const needsLlm: MacroIngredient[] = [];

    for (const ing of ingredients) {
      if (ing.isOptional === true) continue;
      consideredCount++;

      const p = parseMeasure(ing.measure);
      const grams = p ? gramsFromMeasure(p.qty, p.unit) : null;

      if (p && grams != null && deps.fdcApiKey) {
        const per100 = await fetchFdcPer100g(ing.name, deps.fdcApiKey, deps.fetchImpl);
        if (per100) {
          total = addMacros(total, macrosFromPer100g(per100, grams));
          fdcUsed = true;
          resolvedByFdc++;
          continue;
        }
      }
      // No key, no gram quantity, or no FDC match ⇒ hand it to the LLM fallback.
      needsLlm.push(ing);
    }

    // ONE batched LLM call for everything FDC couldn't resolve. Best-effort: a failure just means
    // those ingredients go uncounted (llmUsed stays false), never an error.
    if (needsLlm.length > 0 && deps.llm) {
      try {
        const prompt =
          "Estimate the combined macros for these ingredients, for the whole recipe as written:\n" +
          needsLlm.map(ingredientLine).join("\n");
        const est = await deps.llm.generateStructured(LlmMacrosSchema, prompt, {
          tier: "cheap",
          system: LLM_SYSTEM,
        });
        total = addMacros(total, {
          kcal: est.kcal,
          proteinG: est.proteinG,
          carbsG: est.carbsG,
          fatG: est.fatG,
        });
        llmUsed = true;
      } catch {
        // Fallback unavailable for this part — skip it; the rest of the estimate still stands.
      }
    }

    const source: MacroSource =
      fdcUsed && llmUsed ? "mixed" : fdcUsed ? "fdc" : llmUsed ? "llm" : "none";

    // Confidence: share of ingredients FDC nailed (lab data ⇒ ~1 at full coverage), but floored at
    // 0.3 whenever ANY estimate was produced, since LLM figures are rough. "none" ⇒ 0.
    let confidence = 0;
    if (source !== "none") {
      const coverage = consideredCount > 0 ? resolvedByFdc / consideredCount : 0;
      confidence = Math.max(0.3, clamp01(coverage));
    }

    const scaled = roundMacros(scaleMacros(total, s));
    return { ...scaled, source, confidence };
  } catch {
    // Defensive: nothing above should throw, but macros must never break logging a cook.
    return { ...EMPTY_MACROS, source: "none", confidence: 0 };
  }
}
