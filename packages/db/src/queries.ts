/**
 * Read-model query helpers for the UI (PLAN §5/§7). Kept in @gm/db so the web app stays
 * thin (no direct Drizzle import). Per-user; userId optional until Auth is wired.
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, isNull, like } from "drizzle-orm";
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

// ---- "My Cookbook": saved/favorited recipes (PLAN §10 growth) ----
// Saved recipes ride the preference ledger (no new table). Each save appends a `saved_recipe`
// signal whose `value` is the encodeSaved() JSON; unsave deletes the matching row. The read path
// (loadSavedRecipes → dedupeSaved) tolerates the resulting duplicates, latest-wins.

const SAVED_RECIPE_TOPIC = "saved_recipe";

/**
 * Save a recipe to the user's cookbook — append a `saved_recipe` signal. `value` mirrors
 * core's encodeSaved (id/title/imageUrl/cuisine). polarity "positive"/source "rating" keep it a
 * valid ledger row; the unprefixed topic means projectUserModel ignores it (so it never pollutes
 * the taste model). Flywheel: when a cuisine is known we ALSO append a positive `cuisine:<x>`
 * signal — the exact topic/polarity projectUserModel reads for cuisine affinity (matching
 * signalFromCooked's 0.2 confidence), so favoriting nudges future recipe ranking.
 */
export async function saveRecipe(
  db: Querier,
  userId: string,
  r: { id: string; title: string; imageUrl?: string; cuisine?: string },
) {
  await db.insert(preferenceSignals).values({
    userId,
    topic: SAVED_RECIPE_TOPIC,
    value: JSON.stringify({ id: r.id, title: r.title, imageUrl: r.imageUrl, cuisine: r.cuisine }),
    polarity: "positive",
    source: "rating",
    confidence: 1,
  });
  if (r.cuisine && r.cuisine.trim()) {
    await db.insert(preferenceSignals).values({
      userId,
      topic: `cuisine:${r.cuisine.trim().toLowerCase()}`,
      value: r.cuisine.trim(),
      polarity: "positive",
      source: "rating",
      confidence: 0.2,
    });
  }
}

/**
 * Remove a recipe from the cookbook — delete every `saved_recipe` row for this user whose JSON
 * `value` contains this recipe's id. Parameterized LIKE (the pattern is a bound value, never
 * concatenated into raw SQL). TheMealDB ids are simple alphanumerics, so the `"id":"<id>"`
 * substring is an unambiguous match. The cuisine flywheel signal is intentionally left intact
 * (taste evidence accumulates; un-favoriting one recipe shouldn't erase it).
 */
export async function unsaveRecipe(db: Querier, userId: string, recipeId: string) {
  await db
    .delete(preferenceSignals)
    .where(
      and(
        eq(preferenceSignals.userId, userId),
        eq(preferenceSignals.topic, SAVED_RECIPE_TOPIC),
        like(preferenceSignals.value, `%"id":"${recipeId}"%`),
      ),
    );
}

/** Load a user's saved recipes (raw ledger rows, newest first) — feed to dedupeSaved. */
export async function loadSavedRecipes(db: Querier, userId: string) {
  const rows = await db
    .select({ value: preferenceSignals.value, occurredAt: preferenceSignals.occurredAt })
    .from(preferenceSignals)
    .where(and(eq(preferenceSignals.userId, userId), eq(preferenceSignals.topic, SAVED_RECIPE_TOPIC)))
    .orderBy(desc(preferenceSignals.occurredAt));
  return rows
    .filter((r): r is { value: string; occurredAt: Date } => typeof r.value === "string")
    .map((r) => ({ value: r.value, occurredAt: r.occurredAt as Date }));
}

/** Whether a specific recipe is currently in the user's cookbook. */
export async function isRecipeSaved(db: Querier, userId: string, recipeId: string): Promise<boolean> {
  const rows = await db
    .select({ id: preferenceSignals.id })
    .from(preferenceSignals)
    .where(
      and(
        eq(preferenceSignals.userId, userId),
        eq(preferenceSignals.topic, SAVED_RECIPE_TOPIC),
        like(preferenceSignals.value, `%"id":"${recipeId}"%`),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ---- Shareable Cookbook: a public, unguessable link to a user's saved recipes (PLAN §10 growth) ----
// The share token also rides the preference ledger (no new table): one `cookbook_share_token` signal
// per user, whose `value` is the token. polarity "neutral"/source "rating" keep it a valid ledger row;
// the unprefixed topic means projectUserModel ignores it. The token is minted with node:crypto and is
// long enough to be unguessable; the public page resolves token → the single owning userId, then reads
// ONLY that user's saved recipes via the admin connection (RLS-bypass, but tightly userId-scoped).

const COOKBOOK_TOKEN_TOPIC = "cookbook_share_token";

/**
 * The user's stable cookbook share token, creating one on first use. Idempotent: returns the existing
 * token if a `cookbook_share_token` signal already exists, else mints `randomBytes(18).toString("base64url")`
 * (~24 url-safe chars — comfortably unguessable, no padding) and appends it. Tenant-scoped — call inside
 * `withTenant`, so the INSERT satisfies the RLS WITH CHECK (`user_id = app_current_user_id()`).
 */
export async function getOrCreateCookbookShareToken(db: Querier, userId: string): Promise<string> {
  const existing = await db
    .select({ value: preferenceSignals.value })
    .from(preferenceSignals)
    .where(and(eq(preferenceSignals.userId, userId), eq(preferenceSignals.topic, COOKBOOK_TOKEN_TOPIC)))
    .limit(1);
  const current = existing[0]?.value;
  if (typeof current === "string" && current.length > 0) return current;

  const token = randomBytes(18).toString("base64url");
  await db.insert(preferenceSignals).values({
    userId,
    topic: COOKBOOK_TOKEN_TOPIC,
    value: token,
    polarity: "neutral",
    source: "rating",
    confidence: 1,
  });
  return token;
}

/**
 * Resolve a cookbook share token → the single owning userId (or null). Parameterized `eq` on the token
 * value (never string-concatenated). Used by the PUBLIC share page with the admin connection; the
 * returned userId is the ONLY user input that reaches the subsequent (also `eq`-scoped) saved-recipe read.
 */
export async function getUserIdByCookbookToken(db: Querier, token: string): Promise<string | null> {
  const rows = await db
    .select({ userId: preferenceSignals.userId })
    .from(preferenceSignals)
    .where(and(eq(preferenceSignals.topic, COOKBOOK_TOKEN_TOPIC), eq(preferenceSignals.value, token)))
    .limit(1);
  return rows[0]?.userId ?? null;
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

/**
 * Cooked-meal timestamps for the cooking-streak surface (PLAN §10 growth). Just `cookedAt` within
 * the lookback, scoped to the user — the streak math lives in @gm/core/recipe (currentStreak,
 * longestStreak, cooksThisWeek, weeklyActivity) so it stays pure + testable. 120 days comfortably
 * covers the 8-week activity strip plus a long current/longest streak.
 */
export async function loadCookedAt(db: Querier, userId: string, sinceDays = 120): Promise<Date[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await db
    .select({ cookedAt: mealLogs.cookedAt })
    .from(mealLogs)
    .where(and(eq(mealLogs.userId, userId), gte(mealLogs.cookedAt, since)));
  return rows.filter((r) => r.cookedAt != null).map((r) => r.cookedAt as Date);
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

/**
 * Load a user (by email) for credentials login — includes the password hash so the NextAuth
 * `authorize` callback can verify it. Admin/provisioning scope (cross-tenant, like upsertGoogleAuth).
 */
export async function getUserByEmail(
  db: Querier,
  email: string,
): Promise<{ id: string; email: string; name: string | null; passwordHash: string | null } | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Create a new credentials user (email + password). Admin/provisioning scope — a brand-new user row
 * can't satisfy its own RLS WITH CHECK. The unique email constraint guards against races (callers
 * should still check getUserByEmail first for a friendly error). Returns the new userId.
 */
export async function createUserWithPassword(
  db: Querier,
  a: { email: string; name: string | null; passwordHash: string },
): Promise<string> {
  const rows = await db
    .insert(users)
    .values({ email: a.email, name: a.name, passwordHash: a.passwordHash })
    .returning({ id: users.id });
  return rows[0]!.id;
}

/** Update a user's display name (profile edit). Admin scope so it works alongside provisioning. */
export async function updateUserName(db: Querier, userId: string, name: string | null) {
  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId));
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
