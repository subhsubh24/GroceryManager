/**
 * "Grocery Wrapped" — a tasteful, shareable recap built ONLY from the user's own data
 * (PLAN §10 growth). Pure + tested. Estimates are honest and round (no fake precision):
 * "$ saved vs takeout" is an explicit ballpark from WRAPPED constants, not a measured number.
 */
import { WRAPPED } from "@gm/config/constants";

export interface WrappedInput {
  /** One row per logged cook in the window; recipeTitle null for free-text/unmatched meals. */
  mealLogs: { cookedAt: Date; recipeTitle: string | null }[];
  /** Receipts in the window (totalCents may be null when a receipt parsed without a total). */
  purchases: { totalCents: number | null }[];
  /** Count of `spoilage` ledger events in the window — items let expire. */
  spoilageCount: number;
  /** The lookback the caller used, for the human-friendly period label. */
  windowDays: number;
}

export interface WrappedStats {
  periodLabel: string;
  homeCookedMeals: number;
  totalSpentCents: number;
  /** Estimate only: homeCookedMeals × (takeout − home-cooked per-meal cost), clamped ≥ 0. */
  estSavedCents: number;
  itemsExpired: number;
  topRecipes: { title: string; count: number }[];
}

function periodLabel(windowDays: number): string {
  if (windowDays <= 7) return "this week";
  if (windowDays <= 31) return "this month";
  if (windowDays <= 92) return "this quarter";
  if (windowDays <= 366) return "this year";
  return `the last ${windowDays} days`;
}

export function buildWrapped(input: WrappedInput): WrappedStats {
  const homeCookedMeals = input.mealLogs.length;
  const totalSpentCents = input.purchases.reduce((sum, p) => sum + (p.totalCents ?? 0), 0);

  const perMealSaving = WRAPPED.takeoutMealCents - WRAPPED.homeCookedMealCents;
  const estSavedCents = Math.max(0, homeCookedMeals * perMealSaving);

  const counts = new Map<string, number>();
  for (const m of input.mealLogs) {
    const title = m.recipeTitle?.trim();
    if (!title) continue;
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  const topRecipes = [...counts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, 5);

  return {
    periodLabel: periodLabel(input.windowDays),
    homeCookedMeals,
    totalSpentCents,
    estSavedCents,
    itemsExpired: input.spoilageCount,
    topRecipes,
  };
}
