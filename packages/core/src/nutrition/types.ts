/**
 * Nutrition types (cook-logging with stored macros). A `MacroSet` is the four numbers we store on a
 * cooked meal — energy in kcal, the three macronutrients in grams. `MealMacros` wraps a `MacroSet`
 * with provenance + a rough confidence, so the UI can be honest about how the figure was derived
 * (USDA FoodData Central is primary; the LLM is the fallback when FDC can't answer).
 */

/** Calories + the three macronutrients (grams). The unit of everything in this module. */
export interface MacroSet {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Where a meal's macros came from: fdc (primary), llm (fallback), mixed (both), none (no data). */
export type MacroSource = "fdc" | "llm" | "mixed" | "none";

/** A stored meal's macros + provenance. `confidence` in [0,1] — FDC full coverage ⇒ ~1, LLM ⇒ rough. */
export interface MealMacros extends MacroSet {
  source: MacroSource;
  confidence: number;
}

/** An ingredient to estimate macros for. Mirrors recipe/consume's ConsumeIngredient shape. */
export interface MacroIngredient {
  name: string;
  measure?: string | null;
  isOptional?: boolean;
}
