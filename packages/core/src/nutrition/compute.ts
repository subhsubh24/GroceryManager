/**
 * Macro arithmetic (cook-logging with stored macros) — PURE, no I/O. The estimator (estimate.ts)
 * does the network work; everything quantitative lives here so it's trivially unit-testable.
 *
 * Convention: nutrient data is keyed per-100g (how FoodData Central reports it), so we convert a
 * parsed measure to grams (mass units only — we never fabricate a gram weight from a volume/count),
 * then scale the per-100g figures. Honest where we can, skipped where we can't (see gramsFromMeasure).
 */
import type { MacroSet } from "./types.js";

/** The additive identity — a zero macro set (the running-total seed, and the "no data" result). */
export const EMPTY_MACROS: MacroSet = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

/** Sum two macro sets component-wise. */
export function addMacros(a: MacroSet, b: MacroSet): MacroSet {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
  };
}

/** Scale a macro set by a factor (e.g. grams/100, or servings). */
export function scaleMacros(m: MacroSet, factor: number): MacroSet {
  return {
    kcal: m.kcal * factor,
    proteinG: m.proteinG * factor,
    carbsG: m.carbsG * factor,
    fatG: m.fatG * factor,
  };
}

/** Round for display/storage: kcal to a whole number, grams to one decimal. */
export function roundMacros(m: MacroSet): MacroSet {
  const g = (x: number) => Math.round(x * 10) / 10;
  return {
    kcal: Math.round(m.kcal),
    proteinG: g(m.proteinG),
    carbsG: g(m.carbsG),
    fatG: g(m.fatG),
  };
}

/**
 * Convert a parsed measure to grams — MASS units ONLY. We never derive a gram weight from a volume
 * ("1 cup") or a count ("2 cloves") because that needs an ingredient-specific density; those go to
 * the LLM fallback instead. `unit` is the lowercased unit code parseMeasure returns; anything that
 * isn't a recognized mass unit (including null) ⇒ null.
 */
export function gramsFromMeasure(qty: number, unit: string | null): number | null {
  if (unit == null) return null;
  switch (unit) {
    case "g":
      return qty;
    case "kg":
      return qty * 1000;
    case "mg":
      return qty / 1000;
    case "oz":
      return qty * 28.3495;
    case "lb":
      return qty * 453.592;
    default:
      return null; // volume / count / unknown — not convertible to mass without density
  }
}

/** Scale per-100g macros to an actual gram weight. */
export function macrosFromPer100g(per100g: MacroSet, grams: number): MacroSet {
  return scaleMacros(per100g, grams / 100);
}
