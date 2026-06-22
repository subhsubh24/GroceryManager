/**
 * USDA FoodData Central lookup (cook-logging with stored macros) — the PRIMARY nutrition source. Given
 * an ingredient name + a free API key (https://fdc.nal.usda.gov/api-key-signup.html), fetch the top
 * match and read its per-100g macros. The host is FIXED (api.nal.usda.gov); only the query + key are
 * user/config-controlled, so there's no SSRF surface. `fetchImpl` is injectable for tests.
 *
 * Degrades gracefully: ANY non-200, network error, parse error, or missing energy ⇒ null, so the
 * estimator can fall back to the LLM. Never throws.
 */
import type { MacroSet } from "./types.js";

// FoodData Central reports macros per 100g via numbered nutrients. We match by number first (the
// payload may carry it as `nutrientNumber`/`number` on the row or nested under `nutrient`), then fall
// back to a name contains-match, since the search endpoint's shape varies by dataType.
const NUTRIENT_NUMBERS = {
  kcal: "208", // Energy (kcal)
  proteinG: "203", // Protein
  carbsG: "205", // Carbohydrate, by difference
  fatG: "204", // Total lipid (fat)
} as const;

/** Datasets to search, best-quality first. Foundation/SR Legacy are lab values; FNDDS covers dishes. */
const DATA_TYPES = "Foundation,SR Legacy,Survey (FNDDS)";

interface FdcNutrientRow {
  nutrientNumber?: unknown;
  number?: unknown;
  nutrientName?: unknown;
  unitName?: unknown;
  value?: unknown;
  amount?: unknown;
  nutrient?: { number?: unknown; name?: unknown; unitName?: unknown } | null;
}

function asString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function rowNumber(row: FdcNutrientRow): string | null {
  return asString(row.nutrientNumber) ?? asString(row.number) ?? asString(row.nutrient?.number);
}

function rowName(row: FdcNutrientRow): string {
  return (asString(row.nutrientName) ?? asString(row.nutrient?.name) ?? "").toLowerCase();
}

function rowUnit(row: FdcNutrientRow): string {
  return (asString(row.unitName) ?? asString(row.nutrient?.unitName) ?? "").toLowerCase();
}

function rowValue(row: FdcNutrientRow): number | null {
  return asNumber(row.value) ?? asNumber(row.amount);
}

/**
 * Pull per-100g macros out of a food's nutrient rows. For energy we prefer the kcal entry (some foods
 * also carry a kJ row); for the macronutrients we take the first numeric match. Returns null when
 * there's no usable energy value (the signal that this match isn't worth keeping).
 */
function readPer100g(nutrients: FdcNutrientRow[]): MacroSet | null {
  let kcal: number | null = null;
  let kcalIsKcalUnit = false;
  let proteinG: number | null = null;
  let carbsG: number | null = null;
  let fatG: number | null = null;

  for (const row of nutrients) {
    const num = rowNumber(row);
    const name = rowName(row);
    const unit = rowUnit(row);
    const value = rowValue(row);
    if (value == null) continue;

    const isEnergy = num === NUTRIENT_NUMBERS.kcal || name.includes("energy");
    const isProtein = num === NUTRIENT_NUMBERS.proteinG || name.includes("protein");
    const isCarbs = num === NUTRIENT_NUMBERS.carbsG || name.includes("carbohydrate");
    const isFat = num === NUTRIENT_NUMBERS.fatG || name.includes("lipid");

    if (isEnergy) {
      const thisIsKcal = unit === "kcal" || num === NUTRIENT_NUMBERS.kcal;
      // Prefer a kcal-unit reading over a kJ one; otherwise take the first energy value we see.
      if (kcal == null || (thisIsKcal && !kcalIsKcalUnit)) {
        kcal = value;
        kcalIsKcalUnit = thisIsKcal;
      }
    } else if (isProtein) {
      proteinG ??= value;
    } else if (isCarbs) {
      carbsG ??= value;
    } else if (isFat) {
      fatG ??= value;
    }
  }

  if (kcal == null) return null;
  return { kcal, proteinG: proteinG ?? 0, carbsG: carbsG ?? 0, fatG: fatG ?? 0 };
}

/**
 * Look up an ingredient's per-100g macros from FoodData Central. Returns null on any failure (no
 * match, no energy value, non-200, network/parse error) so the caller can fall back to the LLM.
 */
export async function fetchFdcPer100g(
  name: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MacroSet | null> {
  try {
    const url =
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}` +
      `&query=${encodeURIComponent(name)}&pageSize=1&dataType=${encodeURIComponent(DATA_TYPES)}`;
    const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    if (!json || typeof json !== "object") return null;
    const foods = (json as { foods?: unknown }).foods;
    if (!Array.isArray(foods) || foods.length === 0) return null;
    const first = foods[0];
    if (!first || typeof first !== "object") return null;
    const nutrients = (first as { foodNutrients?: unknown }).foodNutrients;
    if (!Array.isArray(nutrients)) return null;
    return readPer100g(nutrients as FdcNutrientRow[]);
  } catch {
    // No match / network / parse — treat as "no data" so the estimator can route to the LLM.
    return null;
  }
}
