/**
 * Log a cook (PLAN §7.2 + §8.7) — the cook → pantry → taste loop. Must run inside withTenant.
 *
 *   1. upsert the recipe header (dedupe by provider+externalId) so the MealLog has a real title
 *   2. write a MealLog (powers Grocery Wrapped + the weekly digest)
 *   3. decrement the pantry for confidently-convertible ingredients (consume_recipe ledger),
 *      preserving each item's learned rate; honest — no fabricated quantities (see consume.ts)
 *   4. learn the cuisine (signalFromCooked → preference ledger), so the model keeps improving
 *      from what you actually cook, not just onboarding
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  appendPreferenceSignal,
  canonicalItems,
  getPantryView,
  mealLogs,
  pantryStock,
  recipes,
  unitsOfMeasure,
  type Querier,
} from "@gm/db";
import { appendLedgerAndReproject } from "../pantry/persist.js";
import { signalFromCooked } from "../personalization/user-model.js";
import { UnitConverter, type Dimension } from "../units/index.js";
import { planConsumption, type BaseQtyResolver, type ConsumeIngredient } from "./consume.js";

export interface CookRecipeInput {
  externalId: string;
  title: string;
  imageUrl?: string | null;
  cuisine?: string | null;
  ingredients: ConsumeIngredient[];
}

export interface LogCookResult {
  recipeId: string;
  mealLogId: string;
  decremented: number;
  usedUnmeasured: number;
  learnedCuisine: string | null;
}

export async function logCook(
  db: Querier,
  userId: string,
  recipe: CookRecipeInput,
  opts: { servingsMade?: number } = {},
): Promise<LogCookResult> {
  const servings = opts.servingsMade && opts.servingsMade > 0 ? opts.servingsMade : 1;

  // 1. Upsert the recipe header (dedupe by provider + externalId).
  const existing = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.provider, "themealdb"), eq(recipes.externalId, recipe.externalId)))
    .limit(1);
  let recipeId = existing[0]?.id;
  if (!recipeId) {
    const [row] = await db
      .insert(recipes)
      .values({
        provider: "themealdb",
        externalId: recipe.externalId,
        title: recipe.title,
        imageUrl: recipe.imageUrl ?? null,
        cuisines: recipe.cuisine ? [recipe.cuisine.toLowerCase()] : [],
      })
      .returning({ id: recipes.id });
    recipeId = row!.id;
  }

  // 2. Build an honest base-qty resolver from the pantry items' base units.
  const pantry = (await getPantryView(db, userId)).map((p) => ({
    canonicalItemId: p.canonicalItemId,
    name: p.name,
    aliases: p.aliases,
    baseQtyOnHand: Number(p.baseQtyOnHand),
  }));
  const unitRows = await db.select().from(unitsOfMeasure);
  const converter = new UnitConverter(
    unitRows.map((u) => ({
      code: u.code,
      dimension: u.dimension as Dimension,
      toBaseFactor: u.toBaseFactor != null ? Number(u.toBaseFactor) : null,
    })),
  );
  const pantryIds = pantry.map((p) => p.canonicalItemId);
  const baseUnitByItem = new Map<string, { code: string; dimension: Dimension }>();
  if (pantryIds.length) {
    const rows = await db
      .select({ id: canonicalItems.id, code: unitsOfMeasure.code, dimension: unitsOfMeasure.dimension })
      .from(canonicalItems)
      .innerJoin(unitsOfMeasure, eq(canonicalItems.baseUnitId, unitsOfMeasure.id))
      .where(inArray(canonicalItems.id, pantryIds));
    for (const r of rows) baseUnitByItem.set(r.id, { code: r.code, dimension: r.dimension as Dimension });
  }
  const resolveBaseQty: BaseQtyResolver = (id, qty, unit) => {
    const bu = baseUnitByItem.get(id);
    if (!bu) return null;
    if (unit == null) return bu.dimension === "COUNT" || bu.dimension === "DISCRETE" ? qty : null;
    const res = converter.convert(qty, unit, bu.code);
    // Reject the volume↔mass water-density heuristic — too imprecise to decrement honestly.
    return res && res.method !== "heuristic" ? res.qty : null;
  };

  // 3. Plan consumption.
  const plan = planConsumption(recipe.ingredients, pantry, { servingsScale: servings, resolveBaseQty });

  // 4. MealLog.
  const [meal] = await db
    .insert(mealLogs)
    .values({
      userId,
      recipeId,
      servingsMade: servings,
      mealType: "dinner",
      decrementedPantry: plan.deltas.length > 0,
    })
    .returning({ id: mealLogs.id });

  // 5. Apply consume_recipe deltas, preserving each item's learned rate.
  const deltaIds = plan.deltas.map((d) => d.canonicalItemId);
  const rateByItem = new Map<string, number | null>();
  if (deltaIds.length) {
    const rows = await db
      .select({ id: pantryStock.canonicalItemId, rate: pantryStock.estimatedConsumptionRatePerDay })
      .from(pantryStock)
      .where(and(eq(pantryStock.userId, userId), inArray(pantryStock.canonicalItemId, deltaIds)));
    for (const r of rows) rateByItem.set(r.id, r.rate != null ? Number(r.rate) : null);
  }
  const now = new Date();
  for (const d of plan.deltas) {
    await appendLedgerAndReproject(db, {
      userId,
      canonicalItemId: d.canonicalItemId,
      baseQtyDelta: d.baseQtyDelta,
      eventType: "consume_recipe",
      confidence: 0.7,
      refType: "meal_log",
      refId: meal!.id,
      occurredAt: now,
      ratePerDay: rateByItem.get(d.canonicalItemId) ?? null,
    });
  }

  // 6. Learn the cuisine (the always-learning ratchet, applied to you).
  const cuisine = recipe.cuisine?.trim().toLowerCase() || null;
  if (cuisine) {
    const sig = signalFromCooked(cuisine);
    await appendPreferenceSignal(db, {
      userId,
      topic: sig.topic,
      value: sig.value ?? null,
      polarity: sig.polarity,
      source: "meal_log",
      confidence: sig.confidence,
    });
  }

  return {
    recipeId,
    mealLogId: meal!.id,
    decremented: plan.deltas.length,
    usedUnmeasured: plan.usedUnmeasured.length,
    learnedCuisine: cuisine,
  };
}
