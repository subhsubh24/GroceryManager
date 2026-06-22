/**
 * Read-model query helpers for the UI (PLAN §5/§7). Kept in @gm/db so the web app stays
 * thin (no direct Drizzle import). Per-user; userId optional until Auth is wired.
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, isNull, like, or, sql } from "drizzle-orm";
import type { Querier } from "./client.js";
import {
  canonicalItems,
  householdInvites,
  households,
  ingredientMatchOverrides,
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

// ---- Discover: a swipeable "for you" feed whose swipes train the taste model (PLAN §10 growth) ----
// Swipes ride the same preference ledger (no new table). Each swipe records a `recipe_seen` marker
// (unprefixed topic → projectUserModel ignores it) so the card never resurfaces, and — when the
// cuisine is known — a `cuisine:<x>` affinity signal (the exact topic projectUserModel reads). The
// pure swipe→signal mapping lives in @gm/core/recipe (swipeToSignals); these just persist/read.

const RECIPE_SEEN_TOPIC = "recipe_seen";

/** Recipe ids the user has already swiped on (the `recipe_seen` markers' values) — feed nextDiscoveryBatch. */
export async function loadSeenRecipeIds(db: Querier, userId: string): Promise<string[]> {
  const rows = await db
    .select({ value: preferenceSignals.value })
    .from(preferenceSignals)
    .where(and(eq(preferenceSignals.userId, userId), eq(preferenceSignals.topic, RECIPE_SEEN_TOPIC)));
  return rows
    .map((r) => r.value)
    .filter((v): v is string => typeof v === "string" && v.length > 0);
}

/**
 * Persist the signals from one swipe (from core's swipeToSignals) — a batch insert into the ledger,
 * userId-scoped. Call inside `withTenant` so each INSERT satisfies the RLS WITH CHECK. No-op on an
 * empty list. Mirrors appendPreferenceSignal's column mapping (value defaults to null).
 */
export async function recordSwipeSignals(
  db: Querier,
  userId: string,
  signals: { topic: string; value: string | null; polarity: SignalPolarity; source: SignalSource; confidence: number }[],
): Promise<void> {
  if (signals.length === 0) return;
  await db.insert(preferenceSignals).values(
    signals.map((s) => ({
      userId,
      topic: s.topic,
      value: s.value ?? null,
      polarity: s.polarity,
      source: s.source,
      confidence: s.confidence,
    })),
  );
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

// ---- Referrals: invite a friend; both are credited when they join (PLAN §10 growth) ----
// Referrals ride the preference ledger (no new table), mirroring the cookbook share token:
//   • referral_code  — one row per user, value = their stable invite code (tenant-scoped mint).
//   • referral_joined — one row PER credited friend on the REFERRER, value = the new user's id.
//   • referred_by     — one row on the NEW user, value = the referrer's id (their side of the credit).
// polarity "neutral"/source "rating" keep these valid ledger rows; the unprefixed topics mean
// projectUserModel ignores them (they never pollute the taste model). Attribution runs at signup
// with the admin connection (it writes a row for the *referrer*, a different tenant) and is
// best-effort + idempotent — it must never block or break the signup path.

const REFERRAL_CODE_TOPIC = "referral_code";
const REFERRAL_JOINED_TOPIC = "referral_joined";
const REFERRED_BY_TOPIC = "referred_by";

/**
 * The user's stable referral code, creating one on first use. Idempotent: returns the existing code if
 * a `referral_code` signal already exists, else mints `randomBytes(9).toString("base64url")` (~12
 * url-safe chars, no padding) and appends it. Tenant-scoped — call inside `withTenant`, so the INSERT
 * satisfies the RLS WITH CHECK (`user_id = app_current_user_id()`). Mirrors getOrCreateCookbookShareToken.
 */
export async function getOrCreateReferralCode(db: Querier, userId: string): Promise<string> {
  const existing = await db
    .select({ value: preferenceSignals.value })
    .from(preferenceSignals)
    .where(and(eq(preferenceSignals.userId, userId), eq(preferenceSignals.topic, REFERRAL_CODE_TOPIC)))
    .limit(1);
  const current = existing[0]?.value;
  if (typeof current === "string" && current.length > 0) return current;

  const code = randomBytes(9).toString("base64url");
  await db.insert(preferenceSignals).values({
    userId,
    topic: REFERRAL_CODE_TOPIC,
    value: code,
    polarity: "neutral",
    source: "rating",
    confidence: 1,
  });
  return code;
}

/**
 * Resolve a referral code → the single owning (referrer) userId, or null. Parameterized `eq` on the
 * code value (never string-concatenated). Called at signup with the admin connection (the new user has
 * no session yet); the returned userId is the only thing that reaches the subsequent credit write.
 */
export async function getUserIdByReferralCode(db: Querier, code: string): Promise<string | null> {
  const rows = await db
    .select({ userId: preferenceSignals.userId })
    .from(preferenceSignals)
    .where(and(eq(preferenceSignals.topic, REFERRAL_CODE_TOPIC), eq(preferenceSignals.value, code)))
    .limit(1);
  return rows[0]?.userId ?? null;
}

/**
 * Credit a referral when `newUserId` signs up via `referrerUserId`'s link — best-effort attribution.
 * Called with the ADMIN connection (`getAdminDb()`) because it writes a `referral_joined` row for the
 * *referrer* (a different tenant than the new user). Guards:
 *   • self-referral (referrer === new user) → no-op.
 *   • idempotent — if a `referral_joined` row for (referrer, value=newUserId) already exists, return
 *     without writing, so a re-run never double-credits.
 * Otherwise inserts both sides of the credit: the referrer's `referral_joined` and the new user's
 * `referred_by`. (valid polarity/source; confidence 1.) The caller wraps this in try/catch — it must
 * never throw out to the signup path.
 */
export async function recordReferral(
  db: Querier,
  referrerUserId: string,
  newUserId: string,
): Promise<void> {
  if (!referrerUserId || !newUserId || referrerUserId === newUserId) return;

  const already = await db
    .select({ id: preferenceSignals.id })
    .from(preferenceSignals)
    .where(
      and(
        eq(preferenceSignals.userId, referrerUserId),
        eq(preferenceSignals.topic, REFERRAL_JOINED_TOPIC),
        eq(preferenceSignals.value, newUserId),
      ),
    )
    .limit(1);
  if (already.length > 0) return; // already credited — no double credit

  await db.insert(preferenceSignals).values([
    {
      userId: referrerUserId,
      topic: REFERRAL_JOINED_TOPIC,
      value: newUserId,
      polarity: "neutral",
      source: "rating",
      confidence: 1,
    },
    {
      userId: newUserId,
      topic: REFERRED_BY_TOPIC,
      value: referrerUserId,
      polarity: "neutral",
      source: "rating",
      confidence: 1,
    },
  ]);
}

/** How many friends have joined via this user's link — count of their `referral_joined` rows. */
export async function countReferralsJoined(db: Querier, userId: string): Promise<number> {
  const rows = await db
    .select({ id: preferenceSignals.id })
    .from(preferenceSignals)
    .where(and(eq(preferenceSignals.userId, userId), eq(preferenceSignals.topic, REFERRAL_JOINED_TOPIC)));
  return rows.length;
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

export interface CookLogEntry {
  id: string;
  title: string | null;
  imageUrl: string | null;
  cookedAt: Date;
  servingsMade: number | null;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  macrosSource: string | null;
}

/**
 * Recent cook log for the "Meals & macros" page (cook-logging with stored macros): the user's most
 * recent meals with their stored macros + the recipe title/image. Macros are nullable (estimation is
 * best-effort, and rows logged before the feature have none). The explicit userId filter is RLS
 * belt-and-suspenders.
 */
export async function loadCookLog(db: Querier, userId: string, limit = 30): Promise<CookLogEntry[]> {
  const num = (v: unknown): number | null => (v == null ? null : Number(v));
  const rows = await db
    .select({
      id: mealLogs.id,
      title: recipes.title,
      imageUrl: recipes.imageUrl,
      cookedAt: mealLogs.cookedAt,
      servingsMade: mealLogs.servingsMade,
      kcal: mealLogs.kcal,
      proteinG: mealLogs.proteinG,
      carbsG: mealLogs.carbsG,
      fatG: mealLogs.fatG,
      macrosSource: mealLogs.macrosSource,
    })
    .from(mealLogs)
    .leftJoin(recipes, eq(mealLogs.recipeId, recipes.id))
    .where(eq(mealLogs.userId, userId))
    .orderBy(desc(mealLogs.cookedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? null,
    imageUrl: r.imageUrl ?? null,
    cookedAt: r.cookedAt as Date,
    servingsMade: num(r.servingsMade),
    kcal: num(r.kcal),
    proteinG: num(r.proteinG),
    carbsG: num(r.carbsG),
    fatG: num(r.fatG),
    macrosSource: r.macrosSource ?? null,
  }));
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
 * Load a user (by USERNAME) for credentials login — includes the password hash so the NextAuth
 * `authorize` callback can verify it. Pass the NORMALIZED (lowercased) handle. Admin/provisioning
 * scope (cross-tenant, like upsertGoogleAuth).
 */
export async function getUserByUsername(
  db: Querier,
  username: string,
): Promise<{
  id: string;
  username: string | null;
  email: string | null;
  name: string | null;
  passwordHash: string | null;
} | null> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Create a new credentials user (USERNAME + password; email optional — set later on Gmail connect).
 * Admin/provisioning scope — a brand-new user row can't satisfy its own RLS WITH CHECK. The unique
 * username constraint guards against races (callers should still check getUserByUsername first for a
 * friendly error). Returns the new userId.
 */
export async function createUserWithPassword(
  db: Querier,
  a: { username: string; passwordHash: string; name?: string | null; email?: string | null },
): Promise<string> {
  const rows = await db
    .insert(users)
    .values({
      username: a.username,
      email: a.email ?? null,
      name: a.name ?? null,
      passwordHash: a.passwordHash,
    })
    .returning({ id: users.id });
  return rows[0]!.id;
}

/** Update a user's display name (profile edit). Admin scope so it works alongside provisioning. */
export async function updateUserName(db: Querier, userId: string, name: string | null) {
  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId));
}

// ---- One-time shelf-life backfill (PLAN §6): classify items ingestion created before shelf-life ----
// estimation existed, then re-project. Seeded catalog items have a category + shelf life already, so
// "no category AND no shelf life" cleanly targets only the unclassified ingestion-created items.

/** Canonical items with no category and no shelf life — the unclassified set the backfill re-estimates. */
export async function listCanonicalItemsToClassify(
  db: Querier,
): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: canonicalItems.id, name: canonicalItems.name })
    .from(canonicalItems)
    .where(
      and(
        isNull(canonicalItems.category),
        isNull(canonicalItems.shelfLifePantryDays),
        isNull(canonicalItems.shelfLifeFridgeDays),
      ),
    );
}

/** Set an item's domain + perishability + shelf life (and a coarse category marker). Admin scope. */
export async function setCanonicalClassification(
  db: Querier,
  id: string,
  c: {
    domain: "grocery" | "household" | "personal_care" | "supplement";
    perishability: "perishable" | "semi_perishable" | "shelf_stable";
    shelfLifeFridgeDays: number | null;
    shelfLifePantryDays: number | null;
  },
): Promise<void> {
  await db
    .update(canonicalItems)
    .set({
      domain: c.domain,
      perishability: c.perishability,
      shelfLifeFridgeDays: c.shelfLifeFridgeDays,
      shelfLifePantryDays: c.shelfLifePantryDays,
      category: c.domain, // coarse marker so a re-run of the backfill skips it
    })
    .where(eq(canonicalItems.id, id));
}

/** Every (user, item) pantry_stock key — for the one-time reprojection. Admin/cross-tenant scope. */
export async function listAllPantryStockUserItems(
  db: Querier,
): Promise<{ userId: string; canonicalItemId: string }[]> {
  return db
    .select({ userId: pantryStock.userId, canonicalItemId: pantryStock.canonicalItemId })
    .from(pantryStock);
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

/**
 * Attach a Google credential to an EXISTING (already signed-in) user — the "Connect Gmail" path for a
 * username-first account. Fills in email/image only when currently NULL (never clobbers a chosen
 * value), then upserts the encrypted credential on (userId, provider). Admin scope. Use this (not
 * upsertGoogleAuth) whenever there's an active session, so connecting Gmail never spawns a 2nd account.
 */
export async function attachGoogleToUser(db: Querier, userId: string, a: GoogleAuthUpsert): Promise<void> {
  await db
    .update(users)
    .set({
      email: sql`coalesce(${users.email}, ${a.email})`,
      image: sql`coalesce(${users.image}, ${a.image})`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

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
      set: {
        scopes: a.scopes,
        accessTokenEnc: a.accessTokenEnc,
        expiresAt: a.expiresAt,
        updatedAt: new Date(),
        ...(a.refreshTokenEnc ? { refreshTokenEnc: a.refreshTokenEnc } : {}),
      },
    });
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

// ---------------------------------------------------------------------------
// Shared household — opt-in shared shopping list (FEATURE_HOUSEHOLDS, default OFF).
// Everything here is gated by the flag at the call sites; the active-list helpers below are ALSO
// internally flag-aware, so the read/write transparently resolves to the household's shared list when
// (and only when) the flag is on AND the user actually has a household. With the flag off — or for any
// user without a household — every code path is byte-for-byte the per-user behavior as before.
// ---------------------------------------------------------------------------

/** Whether the shared-household feature is enabled (optional env; defaults OFF). */
export function householdsEnabled(): boolean {
  return process.env.FEATURE_HOUSEHOLDS === "1";
}

/**
 * Cheap shape gate for an invite token BEFORE any DB lookup (rejects junk / injection-flavored input).
 * `randomBytes(18).toString("base64url")` yields exactly 24 url-safe chars; allow a small range so a
 * future token-length tweak doesn't silently break. Mirrors the cookbook/referral token posture.
 */
export function isValidInviteToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(token);
}

/**
 * The household a user shares a list with, or null. Returns null unless the flag is ON *and* the user
 * has a `households` membership — so the per-user list path is the default everywhere. Scoped: reads
 * only the caller's own `users` row (RLS allows `id = app_current_user_id()`).
 *
 * KNOWN LIMITATION (by design, scope = "members share ONE list"): once a user joins a household, the
 * active-list helpers resolve to the household's shared list, so any items on a PRE-EXISTING solo list
 * stop showing in their view. Those rows are NOT deleted (they reappear if the user later leaves the
 * household) — accepting an invite does not migrate/merge the old list. Auto-merging is intentionally
 * out of scope here (it would mean writing one member's items under another's tenant + dedup).
 */
async function activeHouseholdId(db: Querier, userId: string): Promise<string | null> {
  if (!householdsEnabled()) return null;
  const rows = await db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.householdId ?? null;
}

/**
 * Create a household, setting the creator as owner AND first member (users.householdId). Returns its
 * id. Tenant-scoped — call inside withTenant; the INSERT satisfies the households WITH CHECK
 * (owner_user_id = app_current_user_id()) and the users UPDATE satisfies the users policy (id = me).
 */
export async function createHousehold(db: Querier, userId: string, name?: string): Promise<string> {
  const created = await db
    .insert(households)
    .values({ ownerUserId: userId, name: name?.trim() || "Household" })
    .returning({ id: households.id });
  const householdId = created[0]!.id;
  await db.update(users).set({ householdId, updatedAt: new Date() }).where(eq(users.id, userId));
  return householdId;
}

/** The household the user belongs to (id + name + owner), or null. Tenant-scoped read. */
export async function getHouseholdForUser(
  db: Querier,
  userId: string,
): Promise<{ id: string; name: string; ownerUserId: string } | null> {
  const me = await db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const householdId = me[0]?.householdId;
  if (!householdId) return null;
  const rows = await db
    .select({ id: households.id, name: households.name, ownerUserId: households.ownerUserId })
    .from(households)
    .where(eq(households.id, householdId))
    .limit(1);
  return rows[0] ?? null;
}

/** A user's household membership pointer (users.householdId), or null. Tenant-scoped read. */
export async function getUserHouseholdId(db: Querier, userId: string): Promise<string | null> {
  const rows = await db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.householdId ?? null;
}

/**
 * Members of a household (id + name + email). Under RLS a member can read only their OWN users row, so
 * the roster is intended to run on the ADMIN connection — tightly scoped by the `householdId` the
 * caller already resolved tenant-scoped (via getHouseholdForUser). Parameterized `eq`.
 */
export async function listHouseholdMembers(
  db: Querier,
  householdId: string,
): Promise<{ id: string; name: string | null; username: string | null; email: string | null }[]> {
  return db
    .select({ id: users.id, name: users.name, username: users.username, email: users.email })
    .from(users)
    .where(eq(users.householdId, householdId))
    .orderBy(desc(users.createdAt));
}

/**
 * Mint a one-time, unguessable invite to the user's household. `randomBytes(18).toString("base64url")`
 * (~24 url-safe chars, no padding — comfortably unguessable). Tenant-scoped — call inside withTenant;
 * the INSERT's WITH CHECK requires the row's household to be the caller's own. Returns the token.
 */
export async function createHouseholdInvite(
  db: Querier,
  userId: string,
  householdId: string,
  expiresAt?: Date | null,
): Promise<string> {
  const token = randomBytes(18).toString("base64url");
  await db.insert(householdInvites).values({
    householdId,
    token,
    createdByUserId: userId,
    expiresAt: expiresAt ?? null,
  });
  return token;
}

/**
 * Resolve an invite token → the invite joined to its household name (for the join page), or null.
 * Token is shape-validated BEFORE lookup, then matched with a parameterized `eq` (never concatenated).
 * Read on the ADMIN connection from the join page (the visitor may not be a member yet). Keeps Drizzle
 * inside @gm/db so the web app stays thin.
 */
export async function getHouseholdInviteByToken(
  db: Querier,
  token: string,
): Promise<{
  id: string;
  householdId: string;
  householdName: string;
  expiresAt: Date | null;
  acceptedByUserId: string | null;
} | null> {
  // Defense in depth: reject malformed tokens before the lookup even if a caller forgot to.
  if (!isValidInviteToken(token)) return null;
  const rows = await db
    .select({
      id: householdInvites.id,
      householdId: householdInvites.householdId,
      householdName: households.name,
      expiresAt: householdInvites.expiresAt,
      acceptedByUserId: householdInvites.acceptedByUserId,
    })
    .from(householdInvites)
    .innerJoin(households, eq(householdInvites.householdId, households.id))
    .where(eq(householdInvites.token, token))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Accept an invite for `userId`: set the invitee's `users.householdId` to the invite's household and
 * stamp `accepted_by_user_id` on the invite. Runs on the ADMIN connection (the invitee isn't a member
 * yet, so neither write would pass member RLS, and the invite row belongs to another tenant). Guards:
 *   • unknown / malformed token → no-op, returns null.
 *   • expired invite → no-op, returns null.
 *   • SINGLE-USE: already accepted by a DIFFERENT user → no-op, returns null (the link burns on first
 *     use; a leaked/forwarded link can't admit a second account). Re-accepting by the SAME user is
 *     idempotent (covers a double-submit / refresh) and simply re-points them at the same household.
 *   • already belongs to a DIFFERENT household → no-op, returns null (don't yank them out of theirs).
 * Returns the joined householdId on success.
 */
export async function acceptHouseholdInvite(
  db: Querier,
  userId: string,
  token: string,
): Promise<string | null> {
  const invite = await getHouseholdInviteByToken(db, token);
  if (!invite) return null;
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return null;
  // Single-use: a consumed invite only re-admits the same acceptor (idempotent double-submit).
  if (invite.acceptedByUserId && invite.acceptedByUserId !== userId) return null;

  // Don't pull a user out of a household they already belong to via someone else's link.
  const me = await db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const current = me[0]?.householdId ?? null;
  if (current && current !== invite.householdId) return null;

  // Claim the invite first, and ONLY if it's still unclaimed (or already ours) — a conditional UPDATE
  // that closes the accept race: two concurrent requests can't both stamp it for different users.
  const claimed = await db
    .update(householdInvites)
    .set({ acceptedByUserId: userId })
    .where(
      and(
        eq(householdInvites.id, invite.id),
        or(isNull(householdInvites.acceptedByUserId), eq(householdInvites.acceptedByUserId, userId)),
      ),
    )
    .returning({ id: householdInvites.id });
  if (claimed.length === 0) return null; // lost the race / just got consumed by someone else

  await db
    .update(users)
    .set({ householdId: invite.householdId, updatedAt: new Date() })
    .where(eq(users.id, userId));
  return invite.householdId;
}

/**
 * The user's current active shopping list, creating an empty manual one if none exists (§7.1/§10).
 * When FEATURE_HOUSEHOLDS is on AND the user has a household, this resolves to the household's shared
 * list (matched/created by household_id); otherwise it's the per-user list, exactly as before.
 */
export async function getOrCreateActiveList(db: Querier, userId: string): Promise<string> {
  const householdId = await activeHouseholdId(db, userId);
  if (householdId) {
    const existing = await db
      .select({ id: shoppingLists.id })
      .from(shoppingLists)
      .where(and(eq(shoppingLists.householdId, householdId), eq(shoppingLists.status, "active")))
      .orderBy(desc(shoppingLists.createdAt))
      .limit(1);
    if (existing[0]) return existing[0].id;
    // The creator's user_id satisfies the NOT NULL column; RLS admits other members via household_id.
    const created = await db
      .insert(shoppingLists)
      .values({ userId, householdId, name: "Shopping list", generatedBy: "manual" })
      .returning({ id: shoppingLists.id });
    return created[0]!.id;
  }

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

/**
 * Items on the active list (with canonical names) for display. Household-aware to match
 * getOrCreateActiveList: members read the shared list; solo users (or flag-off) read their own list,
 * unchanged.
 */
export async function getActiveListView(db: Querier, userId: string) {
  const householdId = await activeHouseholdId(db, userId);
  const list = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(
      householdId
        ? and(eq(shoppingLists.householdId, householdId), eq(shoppingLists.status, "active"))
        : and(eq(shoppingLists.userId, userId), eq(shoppingLists.status, "active")),
    )
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

/** One review line item joined to its purchase (ownership-scoped), or null — feeds the confirm action. */
export async function getReviewLineItem(
  db: Querier,
  userId: string,
  lineItemId: string,
): Promise<{
  id: string;
  canonicalItemId: string | null;
  rawText: string;
  quantity: number | null;
  baseQty: number | null;
  purchasedAt: Date;
} | null> {
  const rows = await db
    .select({
      id: purchaseLineItems.id,
      canonicalItemId: purchaseLineItems.canonicalItemId,
      rawText: purchaseLineItems.rawText,
      parsedQty: purchaseLineItems.parsedQty,
      baseQty: purchaseLineItems.baseQty,
      purchasedAt: purchases.purchasedAt,
    })
    .from(purchaseLineItems)
    .innerJoin(purchases, eq(purchaseLineItems.purchaseId, purchases.id))
    .where(and(eq(purchases.userId, userId), eq(purchaseLineItems.id, lineItemId)))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    canonicalItemId: r.canonicalItemId ?? null,
    rawText: r.rawText,
    quantity: r.parsedQty != null ? Number(r.parsedQty) : null,
    baseQty: r.baseQty != null ? Number(r.baseQty) : null,
    purchasedAt: r.purchasedAt as Date,
  };
}

/** Clear a line item's needs-review flag (ownership pre-verified by caller + RLS). */
export async function clearLineItemReview(db: Querier, userId: string, lineItemId: string) {
  await db
    .update(purchaseLineItems)
    .set({ needsReview: false })
    .where(eq(purchaseLineItems.id, lineItemId));
}

/** Teach future matches: record a raw-text → canonical override for this user. */
export async function addMatchOverride(
  db: Querier,
  userId: string,
  rawText: string | null,
  canonicalItemId: string,
) {
  await db.insert(ingredientMatchOverrides).values({ userId, rawText, canonicalItemId });
}

/** Hard-remove an item from the pantry: drop its ledger then its projection (gone until re-purchased). */
export async function removePantryItem(db: Querier, userId: string, canonicalItemId: string) {
  await db
    .delete(stockLedger)
    .where(and(eq(stockLedger.userId, userId), eq(stockLedger.canonicalItemId, canonicalItemId)));
  await db
    .delete(pantryStock)
    .where(and(eq(pantryStock.userId, userId), eq(pantryStock.canonicalItemId, canonicalItemId)));
}

/**
 * Fresh start: wipe a user's pantry projection + full ledger + receipt history (purchase_line_items
 * cascade from purchases). Re-importing receipts or re-scanning rebuilds it cleanly with no dedup in
 * the way. Preferences, canonical catalog, and saved recipes are intentionally kept.
 */
export async function clearPantry(db: Querier, userId: string) {
  await db.delete(purchases).where(eq(purchases.userId, userId)); // cascades purchase_line_items
  await db.delete(stockLedger).where(eq(stockLedger.userId, userId));
  await db.delete(pantryStock).where(eq(pantryStock.userId, userId));
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
