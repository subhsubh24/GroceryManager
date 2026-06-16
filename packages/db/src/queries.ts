/**
 * Read-model query helpers for the UI (PLAN §5/§7). Kept in @gm/db so the web app stays
 * thin (no direct Drizzle import). Per-user; userId optional until Auth is wired.
 */
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import type { Querier } from "./client.js";
import {
  canonicalItems,
  mealLogs,
  oauthCredentials,
  pantryStock,
  preferenceSignals,
  purchaseLineItems,
  purchases,
  pushSubscriptions,
  recipeIngredients,
  recipes,
  reorderPolicies,
  shoppingListItems,
  shoppingLists,
  stockLedger,
  userModels,
  users,
} from "./schema.js";

type SignalPolarity = "positive" | "negative" | "neutral";
type SignalSource =
  | "onboarding_q"
  | "meal_log"
  | "skip"
  | "reorder"
  | "waste"
  | "rating"
  | "chat"
  | "correction";

/** Append to the preference ledger (PLAN §8.7). */
export async function appendPreferenceSignal(
  db: Querier,
  a: { userId: string; topic: string; value?: string | null; polarity: SignalPolarity; source: SignalSource; confidence: number },
) {
  await db.insert(preferenceSignals).values({
    userId: a.userId,
    topic: a.topic,
    value: a.value ?? null,
    polarity: a.polarity,
    source: a.source,
    confidence: a.confidence,
  });
}

/** Load a user's preference signals (shape feeds projectUserModel). */
export async function loadPreferenceSignals(db: Querier, userId: string) {
  const rows = await db
    .select({
      topic: preferenceSignals.topic,
      value: preferenceSignals.value,
      polarity: preferenceSignals.polarity,
      confidence: preferenceSignals.confidence,
    })
    .from(preferenceSignals)
    .where(eq(preferenceSignals.userId, userId));
  return rows.map((r) => ({
    topic: r.topic,
    value: r.value,
    polarity: r.polarity as SignalPolarity,
    confidence: r.confidence,
  }));
}

/** Upsert the projected UserModel (cleanly-mappable fields). */
export async function persistUserModel(
  db: Querier,
  userId: string,
  m: {
    diets: string[];
    allergens: string[];
    cuisineAffinity: Record<string, number>;
    qualityPrefs: Record<string, boolean>;
    confidencePerField: Record<string, number>;
  },
) {
  const values = {
    diets: m.diets,
    allergens: m.allergens,
    cuisineAffinity: m.cuisineAffinity,
    qualityPrefs: m.qualityPrefs,
    confidencePerField: m.confidencePerField,
  };
  await db
    .insert(userModels)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userModels.userId, set: { ...values, updatedAt: new Date() } });
}

// ---- Spend & price intelligence (PLAN §10) ----

export async function loadPurchasesForSpend(db: Querier, userId: string, sinceDays = 120) {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await db
    .select({ purchasedAt: purchases.purchasedAt, totalCents: purchases.totalCents })
    .from(purchases)
    .where(and(eq(purchases.userId, userId), gte(purchases.purchasedAt, since)));
  return rows
    .filter((r) => r.purchasedAt != null)
    .map((r) => ({ purchasedAt: r.purchasedAt as Date, totalCents: r.totalCents }));
}

export async function loadLineItemsForSpend(db: Querier, userId: string, sinceDays = 120) {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await db
    .select({
      canonicalItemId: purchaseLineItems.canonicalItemId,
      name: canonicalItems.name,
      retailer: purchases.retailer,
      purchasedAt: purchases.purchasedAt,
      unitPriceCents: purchaseLineItems.unitPriceCents,
      lineTotalCents: purchaseLineItems.lineTotalCents,
    })
    .from(purchaseLineItems)
    .innerJoin(purchases, eq(purchaseLineItems.purchaseId, purchases.id))
    .innerJoin(canonicalItems, eq(purchaseLineItems.canonicalItemId, canonicalItems.id))
    .where(and(eq(purchases.userId, userId), gte(purchases.purchasedAt, since)));
  return rows.map((r) => ({
    canonicalItemId: r.canonicalItemId as string,
    name: r.name,
    retailer: r.retailer as string,
    purchasedAt: r.purchasedAt as Date,
    unitPriceCents: r.unitPriceCents,
    lineTotalCents: r.lineTotalCents,
  }));
}

/**
 * Inputs for the "Grocery Wrapped" recap (PLAN §10 growth): cooked meals (+ recipe title),
 * grocery spend, and the count of items let expire — all within the lookback window.
 * Aggregation lives in @gm/core/spend (buildWrapped) so it stays pure + testable.
 */
export async function loadWrappedInputs(db: Querier, userId: string, sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const [meals, purchaseRows, spoilage] = await Promise.all([
    db
      .select({ cookedAt: mealLogs.cookedAt, recipeTitle: recipes.title })
      .from(mealLogs)
      .leftJoin(recipes, eq(mealLogs.recipeId, recipes.id))
      .where(and(eq(mealLogs.userId, userId), gte(mealLogs.cookedAt, since))),
    db
      .select({ totalCents: purchases.totalCents })
      .from(purchases)
      .where(and(eq(purchases.userId, userId), gte(purchases.purchasedAt, since))),
    db
      .select({ id: stockLedger.id })
      .from(stockLedger)
      .where(
        and(
          eq(stockLedger.userId, userId),
          eq(stockLedger.eventType, "spoilage"),
          gte(stockLedger.occurredAt, since),
        ),
      ),
  ]);
  return {
    mealLogs: meals.map((m) => ({
      cookedAt: m.cookedAt as Date,
      recipeTitle: m.recipeTitle ?? null,
    })),
    purchases: purchaseRows.map((p) => ({ totalCents: p.totalCents })),
    spoilageCount: spoilage.length,
    windowDays: sinceDays,
  };
}

export async function getUserBudgetCents(db: Querier, userId: string): Promise<number | null> {
  const rows = await db
    .select({ weeklyBudgetCents: userModels.weeklyBudgetCents })
    .from(userModels)
    .where(eq(userModels.userId, userId))
    .limit(1);
  return rows[0]?.weeklyBudgetCents ?? null;
}

/** Upsert just the weekly budget on the materialized UserModel (PLAN §8.7 onboarding). */
export async function setWeeklyBudgetCents(db: Querier, userId: string, cents: number) {
  await db
    .insert(userModels)
    .values({ userId, weeklyBudgetCents: cents })
    .onConflictDoUpdate({
      target: userModels.userId,
      set: { weeklyBudgetCents: cents, updatedAt: new Date() },
    });
}

/** Spoilage events with item names (PLAN §10 waste hub) — feeds summarizeWaste. */
export async function loadWasteEvents(db: Querier, userId: string, sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await db
    .select({
      canonicalItemId: stockLedger.canonicalItemId,
      name: canonicalItems.name,
      baseQtyDelta: stockLedger.baseQtyDelta,
      occurredAt: stockLedger.occurredAt,
    })
    .from(stockLedger)
    .innerJoin(canonicalItems, eq(stockLedger.canonicalItemId, canonicalItems.id))
    .where(
      and(
        eq(stockLedger.userId, userId),
        eq(stockLedger.eventType, "spoilage"),
        gte(stockLedger.occurredAt, since),
      ),
    )
    .orderBy(desc(stockLedger.occurredAt));
  return rows.map((r) => ({
    canonicalItemId: r.canonicalItemId,
    name: r.name,
    baseQtyDelta: Number(r.baseQtyDelta),
    occurredAt: r.occurredAt as Date,
  }));
}

export interface GoogleAuthUpsert {
  email: string;
  name: string | null;
  image: string | null;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  scopes: string[];
  expiresAt: Date | null;
}

/** Upsert the user (by email) + their encrypted Google OAuth credential. Returns userId. */
export async function upsertGoogleAuth(db: Querier, a: GoogleAuthUpsert): Promise<string> {
  const u = await db
    .insert(users)
    .values({ email: a.email, name: a.name, image: a.image })
    .onConflictDoUpdate({ target: users.email, set: { name: a.name, image: a.image, updatedAt: new Date() } })
    .returning({ id: users.id });
  const userId = u[0]!.id;

  await db
    .insert(oauthCredentials)
    .values({
      userId,
      provider: "google",
      scopes: a.scopes,
      accessTokenEnc: a.accessTokenEnc,
      refreshTokenEnc: a.refreshTokenEnc,
      expiresAt: a.expiresAt,
    })
    .onConflictDoUpdate({
      target: [oauthCredentials.userId, oauthCredentials.provider],
      // Google only returns a refresh_token on first consent — don't clobber it with null.
      set: {
        scopes: a.scopes,
        accessTokenEnc: a.accessTokenEnc,
        expiresAt: a.expiresAt,
        updatedAt: new Date(),
        ...(a.refreshTokenEnc ? { refreshTokenEnc: a.refreshTokenEnc } : {}),
      },
    });
  return userId;
}

/** A user's stored Google credential (encrypted) for the worker to use. */
export async function getGoogleCredential(db: Querier, userId: string) {
  const rows = await db
    .select({
      userId: oauthCredentials.userId,
      accessTokenEnc: oauthCredentials.accessTokenEnc,
      refreshTokenEnc: oauthCredentials.refreshTokenEnc,
      expiresAt: oauthCredentials.expiresAt,
      historyId: oauthCredentials.historyId,
    })
    .from(oauthCredentials)
    .where(and(eq(oauthCredentials.userId, userId), eq(oauthCredentials.provider, "google")))
    .limit(1);
  return rows[0] ?? null;
}

/** All users who have connected Google (for the poll worker to iterate). */
export async function listGoogleUserIds(db: Querier): Promise<string[]> {
  const rows = await db
    .select({ userId: oauthCredentials.userId })
    .from(oauthCredentials)
    .where(eq(oauthCredentials.provider, "google"));
  return rows.map((r) => r.userId);
}

export async function updateGoogleTokens(
  db: Querier,
  userId: string,
  a: { accessTokenEnc: string; expiresAt: Date | null },
) {
  await db
    .update(oauthCredentials)
    .set({ accessTokenEnc: a.accessTokenEnc, expiresAt: a.expiresAt, updatedAt: new Date() })
    .where(and(eq(oauthCredentials.userId, userId), eq(oauthCredentials.provider, "google")));
}

export async function setGmailHistoryId(db: Querier, userId: string, historyId: string) {
  await db
    .update(oauthCredentials)
    .set({ historyId, updatedAt: new Date() })
    .where(and(eq(oauthCredentials.userId, userId), eq(oauthCredentials.provider, "google")));
}

/** Persist the registered Gmail watch (historyId + expiry) after users.watch (PLAN §5.1). */
export async function setGmailWatch(
  db: Querier,
  userId: string,
  a: { historyId: string; watchExpiresAt: Date },
) {
  await db
    .update(oauthCredentials)
    .set({ historyId: a.historyId, watchExpiresAt: a.watchExpiresAt, updatedAt: new Date() })
    .where(and(eq(oauthCredentials.userId, userId), eq(oauthCredentials.provider, "google")));
}

/** Map a Gmail address (from a Pub/Sub push) → userId. Admin/provisioning scope (cross-tenant). */
export async function getUserIdByEmail(db: Querier, email: string): Promise<string | null> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return rows[0]?.id ?? null;
}

/** Store a web-push subscription for a user (replacing any prior row with the same endpoint). */
export async function savePushSubscription(
  db: Querier,
  userId: string,
  sub: { endpoint: string; p256dh: string; auth: string },
) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
  await db.insert(pushSubscriptions).values({
    userId,
    endpoint: sub.endpoint,
    keysP256dh: sub.p256dh,
    keysAuth: sub.auth,
  });
}

/** Remove a subscription by endpoint (on unsubscribe, or when the push service reports it gone). */
export async function deletePushSubscription(db: Querier, endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function listPushSubscriptions(db: Querier, userId: string) {
  return db
    .select({
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.keysP256dh,
      auth: pushSubscriptions.keysAuth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

/** Users who have at least one push subscription (admin scope — for the digest cron to iterate). */
export async function listUserIdsWithPush(db: Querier): Promise<string[]> {
  const rows = await db.select({ userId: pushSubscriptions.userId }).from(pushSubscriptions);
  return [...new Set(rows.map((r) => r.userId))];
}

/** Catalog items with no embedding yet (for the §5.4 backfill). Shared catalog — admin scope. */
export async function listItemsNeedingEmbedding(db: Querier): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: canonicalItems.id, name: canonicalItems.name })
    .from(canonicalItems)
    .where(isNull(canonicalItems.embedding));
}

export async function setItemEmbedding(db: Querier, id: string, embedding: number[]) {
  await db.update(canonicalItems).set({ embedding }).where(eq(canonicalItems.id, id));
}

export interface ImportedRecipeRow {
  title: string;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  instructions?: string | null;
  ingredients: { name: string; measure?: string | null }[];
}

/** Persist an imported recipe (provider "user") + its ingredient lines; returns the recipe id.
 * Deduped by source URL when present so re-importing the same link reuses the row (§10). */
export async function saveImportedRecipe(db: Querier, recipe: ImportedRecipeRow): Promise<string> {
  if (recipe.sourceUrl) {
    const existing = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(eq(recipes.provider, "user"), eq(recipes.externalId, recipe.sourceUrl)))
      .limit(1);
    if (existing[0]) return existing[0].id;
  }
  const [row] = await db
    .insert(recipes)
    .values({
      provider: "user",
      externalId: recipe.sourceUrl ?? null,
      title: recipe.title,
      imageUrl: recipe.imageUrl ?? null,
      instructions: recipe.instructions ?? null, // jsonb stores the steps blob as a string
      sourceUrl: recipe.sourceUrl ?? null,
    })
    .returning({ id: recipes.id });
  const recipeId = row!.id;
  if (recipe.ingredients.length) {
    await db.insert(recipeIngredients).values(
      recipe.ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({ recipeId, rawText: i.measure ? `${i.measure} ${i.name}` : i.name })),
    );
  }
  return recipeId;
}

/** Load a persisted recipe (by uuid) into the shape Cook Mode / share pages use. */
export async function loadRecipeForCook(db: Querier, id: string) {
  const [r] = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      imageUrl: recipes.imageUrl,
      instructions: recipes.instructions,
      sourceUrl: recipes.sourceUrl,
    })
    .from(recipes)
    .where(eq(recipes.id, id))
    .limit(1);
  if (!r) return null;
  const ings = await db
    .select({ rawText: recipeIngredients.rawText })
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, id));
  return {
    id: r.id,
    title: r.title,
    imageUrl: r.imageUrl ?? undefined,
    instructions: typeof r.instructions === "string" ? r.instructions : undefined,
    sourceUrl: r.sourceUrl ?? undefined,
    ingredients: ings.map((x) => ({ name: x.rawText })),
  };
}

/** The user's current active shopping list, creating an empty manual one if none exists (§7.1/§10). */
export async function getOrCreateActiveList(db: Querier, userId: string): Promise<string> {
  const existing = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.userId, userId), eq(shoppingLists.status, "active")))
    .orderBy(desc(shoppingLists.createdAt))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const created = await db
    .insert(shoppingLists)
    .values({ userId, name: "Shopping list", generatedBy: "manual" })
    .returning({ id: shoppingLists.id });
  return created[0]!.id;
}

/** Items on the active list (with canonical names) for display. */
export async function getActiveListView(db: Querier, userId: string) {
  const list = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.userId, userId), eq(shoppingLists.status, "active")))
    .orderBy(desc(shoppingLists.createdAt))
    .limit(1);
  if (!list[0]) return [];
  return db
    .select({
      id: shoppingListItems.id,
      name: canonicalItems.name,
      reason: shoppingListItems.reason,
      checked: shoppingListItems.checked,
    })
    .from(shoppingListItems)
    .innerJoin(canonicalItems, eq(shoppingListItems.canonicalItemId, canonicalItems.id))
    .where(eq(shoppingListItems.shoppingListId, list[0].id));
}

/** Demo helper until Auth.js is wired: the most recently created user. */
export async function getLatestUserId(db: Querier): Promise<string | null> {
  const rows = await db.select({ id: users.id }).from(users).orderBy(desc(users.createdAt)).limit(1);
  return rows[0]?.id ?? null;
}

export async function getPantryView(db: Querier, userId: string) {
  return db
    .select({
      canonicalItemId: pantryStock.canonicalItemId,
      name: canonicalItems.name,
      aliases: canonicalItems.aliases,
      domain: canonicalItems.domain,
      status: pantryStock.status,
      baseQtyOnHand: pantryStock.baseQtyOnHand,
      confidence: pantryStock.confidence,
      estimatedRunOutAt: pantryStock.estimatedRunOutAt,
    })
    .from(pantryStock)
    .innerJoin(canonicalItems, eq(pantryStock.canonicalItemId, canonicalItems.id))
    .where(eq(pantryStock.userId, userId))
    .orderBy(desc(pantryStock.updatedAt));
}

export async function getReviewQueue(db: Querier, userId: string) {
  return db
    .select({
      id: purchaseLineItems.id,
      rawText: purchaseLineItems.rawText,
      matchConfidence: purchaseLineItems.matchConfidence,
      canonicalName: canonicalItems.name,
      retailer: purchases.retailer,
      purchasedAt: purchases.purchasedAt,
    })
    .from(purchaseLineItems)
    .innerJoin(purchases, eq(purchaseLineItems.purchaseId, purchases.id))
    .leftJoin(canonicalItems, eq(purchaseLineItems.canonicalItemId, canonicalItems.id))
    .where(and(eq(purchases.userId, userId), eq(purchaseLineItems.needsReview, true)))
    .orderBy(desc(purchases.purchasedAt));
}

/**
 * Inputs for the reorder/draft-order engine: pantry stock + (optional) reorder policy per item,
 * normalized to plain numbers so `buildDraftOrders` can consume it directly.
 * (asin/packageQty/unit are null until the products/Amazon vertical is wired.)
 */
export async function loadReorderInputs(db: Querier, userId: string) {
  const rows = await db
    .select({
      canonicalItemId: pantryStock.canonicalItemId,
      name: canonicalItems.name,
      domain: canonicalItems.domain,
      baseQtyOnHand: pantryStock.baseQtyOnHand,
      ratePerDay: pantryStock.estimatedConsumptionRatePerDay,
      confidence: pantryStock.confidence,
      status: pantryStock.status,
      enabled: reorderPolicies.enabled,
      targetParQty: reorderPolicies.targetParQty,
      reorderPointQty: reorderPolicies.reorderPointQty,
      leadTimeDays: reorderPolicies.leadTimeDays,
      minIntervalDays: reorderPolicies.minIntervalDays,
      dosesPerDay: reorderPolicies.dosesPerDay,
      unitsPerPackage: canonicalItems.unitsPerPackage,
    })
    .from(pantryStock)
    .innerJoin(canonicalItems, eq(pantryStock.canonicalItemId, canonicalItems.id))
    .leftJoin(
      reorderPolicies,
      and(
        eq(reorderPolicies.userId, userId),
        eq(reorderPolicies.canonicalItemId, pantryStock.canonicalItemId),
      ),
    )
    .where(eq(pantryStock.userId, userId));

  return rows.map((r) => ({
    canonicalItemId: r.canonicalItemId,
    name: r.name,
    domain: r.domain,
    unit: null as string | null,
    baseQtyOnHand: Number(r.baseQtyOnHand),
    ratePerDay: r.ratePerDay != null ? Number(r.ratePerDay) : null,
    confidence: r.confidence,
    status: r.status as string,
    enabled: r.enabled,
    targetParQty: r.targetParQty != null ? Number(r.targetParQty) : null,
    reorderPointQty: r.reorderPointQty != null ? Number(r.reorderPointQty) : null,
    leadTimeDays: r.leadTimeDays,
    minIntervalDays: r.minIntervalDays,
    lastSuggestedAt: null as Date | null,
    packageQty: r.unitsPerPackage != null ? Number(r.unitsPerPackage) : null,
    asin: null as string | null,
    dosesPerDay: r.dosesPerDay != null ? Number(r.dosesPerDay) : null,
    unitsPerPackage: r.unitsPerPackage != null ? Number(r.unitsPerPackage) : null,
  }));
}

/** Set (or clear) the per-user daily dosage for an item — upserts the reorder policy row (§6). */
export async function setReorderDosage(
  db: Querier,
  userId: string,
  canonicalItemId: string,
  dosesPerDay: number | null,
) {
  const value = dosesPerDay != null ? String(dosesPerDay) : null;
  await db
    .insert(reorderPolicies)
    // A fresh row from setting a dose is NOT auto-enabled — dosage drives run-out prediction; the
    // user still opts into autopilot ordering separately. On an existing row, leave `enabled` alone.
    .values({ userId, canonicalItemId, enabled: false, dosesPerDay: value })
    .onConflictDoUpdate({
      target: [reorderPolicies.userId, reorderPolicies.canonicalItemId],
      set: { dosesPerDay: value, updatedAt: new Date() },
    });
}

/**
 * Toggle a staple onto/off "autopilot" (PLAN §7.1). On first enable, seed par/reorder-point from
 * the caller-computed defaults; on re-enable, preserve any tuned par and just flip the flags.
 */
export async function setReorderAutopilot(
  db: Querier,
  userId: string,
  canonicalItemId: string,
  enabled: boolean,
  seed?: { targetParQty: number; reorderPointQty: number; leadTimeDays: number; minIntervalDays: number },
) {
  await db
    .insert(reorderPolicies)
    .values({
      userId,
      canonicalItemId,
      enabled,
      isStaple: enabled,
      targetParQty: seed ? String(seed.targetParQty) : null,
      reorderPointQty: seed ? String(seed.reorderPointQty) : null,
      leadTimeDays: seed?.leadTimeDays ?? 2,
      minIntervalDays: seed?.minIntervalDays ?? 7,
    })
    .onConflictDoUpdate({
      target: [reorderPolicies.userId, reorderPolicies.canonicalItemId],
      set: { enabled, isStaple: enabled, updatedAt: new Date() },
    });
}
