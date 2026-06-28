/**
 * GroceryManager database schema (PLAN §4).
 *
 * Design pillars:
 *  - Product ↔ CanonicalItem split: messy SKUs converge on one clean "food/household" node.
 *  - Base-unit stock + per-item conversions + an append-only StockLedger (Grocy-style).
 *  - PantryStock is a *projection* of StockLedger.
 *  - The catalog is multi-domain (grocery | household | personal_care) — same spine, two verticals.
 *  - UserModel is a projection of an append-only PreferenceSignal "preference ledger".
 *
 * pgvector + pg_trgm extensions are created in sql/0000_extensions.sql (see migrate.ts).
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/** Matryoshka-truncated gemini-embedding-001 dim (≤2000 keeps the pgvector index valid). */
const VECTOR_DIM = 1536;

/** pgvector column type. Stores number[]; (de)serializes the `[a,b,c]` wire format. */
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${VECTOR_DIM})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    return value.slice(1, -1).split(",").map(Number);
  },
});

// numeric(12,3) for all quantities — never floats, to avoid drift across many small decrements.
const qty = (name: string) => numeric(name, { precision: 12, scale: 3 });
const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").defaultNow().notNull();
const updatedAt = () => ts("updated_at").defaultNow().notNull();

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const domainEnum = pgEnum("domain", ["grocery", "household", "personal_care", "supplement"]);
export const unitDimensionEnum = pgEnum("unit_dimension", ["MASS", "VOLUME", "COUNT", "DISCRETE"]);
export const perishabilityEnum = pgEnum("perishability", ["perishable", "semi_perishable", "shelf_stable"]);
export const retailerEnum = pgEnum("retailer", ["amazon", "whole_foods", "instacart", "other"]);
export const conversionSourceEnum = pgEnum("conversion_source", ["fdc", "usda", "heuristic", "user", "llm"]);
export const purchaseSourceEnum = pgEnum("purchase_source", [
  "gmail_amazon",
  "gmail_wfm",
  "gmail_instacart",
  "amazon_scrape",
  "manual",
  "barcode",
]);
export const purchaseStatusEnum = pgEnum("purchase_status", ["parsed", "needs_review", "confirmed"]);
export const matchMethodEnum = pgEnum("match_method", ["override", "upc", "trigram", "embedding", "llm", "manual"]);
export const stockStatusEnum = pgEnum("stock_status", ["in_stock", "low", "out", "expired_likely"]);
export const stockSourceEnum = pgEnum("stock_source", ["derived", "user_confirmed"]);
export const ledgerEventEnum = pgEnum("ledger_event_type", [
  "purchase",
  "consume_recipe",
  "consume_inferred",
  "vision_confirmed",
  "manual_adjust",
  "spoilage",
  "correction",
  "open",
]);
export const consumptionMethodEnum = pgEnum("consumption_method", ["decay_model", "cadence", "user_reported"]);
export const scanLocationEnum = pgEnum("scan_location", ["fridge", "pantry", "freezer", "other"]);
export const scanStatusEnum = pgEnum("scan_status", ["processing", "reviewed"]);
export const detectionActionEnum = pgEnum("detection_action", [
  "confirm_present",
  "new_item",
  "qty_adjust",
  "ignored",
]);
export const cleanupLoadEnum = pgEnum("cleanup_load", ["low", "med", "high"]);
export const recipeProviderEnum = pgEnum("recipe_provider", ["spoonacular", "themealdb", "user"]);
export const shoppingListStatusEnum = pgEnum("shopping_list_status", ["active", "pushed", "archived"]);
export const shoppingListGenByEnum = pgEnum("shopping_list_generated_by", [
  "reorder_engine",
  "recipe_plan",
  "agent",
  "manual",
]);
export const shoppingItemReasonEnum = pgEnum("shopping_item_reason", [
  "predicted_runout",
  "recipe_need",
  "low_stock",
  "manual",
]);
export const prefPolarityEnum = pgEnum("preference_polarity", ["positive", "negative", "neutral"]);
export const prefSourceEnum = pgEnum("preference_source", [
  "onboarding_q",
  "meal_log",
  "skip",
  "reorder",
  "waste",
  "rating",
  "chat",
  "correction",
]);

// ---------------------------------------------------------------------------
// Auth (Auth.js-compatible, trimmed) + per-user secrets
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Login handle for credentials accounts — the user types THIS, not an email (sql/0006). Unique,
  // stored lowercased (normalizeUsername). Nullable so a Google-keyed row could exist without one.
  username: text("username").unique(),
  // NULLABLE now: credentials signup collects only a username; email is set when the user connects
  // Gmail (from the Google profile). Still unique — Postgres allows many NULLs (sql/0006).
  email: text("email").unique(),
  name: text("name"),
  image: text("image"),
  // Optional phone for SMS digests (the opt-in text channel). Presence = opted in; clearing it opts
  // out. Added in sql/0009_notifications.sql.
  phone: text("phone"),
  // Credentials login (email + password). Null for Google-only / unset accounts. scrypt: salt:hex.
  passwordHash: text("password_hash"),
  // Membership pointer into `households` (opt-in shared shopping list, FEATURE_HOUSEHOLDS, default OFF).
  // NULL for every solo user — the per-user RLS path is unaffected when this is unset. The FK is added
  // in sql/0005_households.sql (the column predates `households`, so it stays a bare uuid here).
  householdId: uuid("household_id"),
  role: text("role").default("user").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Long-lived offline Gmail access + sync cursor. Tokens stored ENCRYPTED (envelope/KMS). */
export const oauthCredentials = pgTable(
  "oauth_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "google"
    scopes: text("scopes").array().notNull().default(sql`'{}'`),
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    expiresAt: ts("expires_at"),
    historyId: text("history_id"), // last synced Gmail historyId
    watchExpiresAt: ts("watch_expires_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ byUserProvider: uniqueIndex("oauth_user_provider_uq").on(t.userId, t.provider) }),
);

/** Web-push subscriptions for the proactive digest / run-out nudges (PLAN §10). */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  keysP256dh: text("keys_p256dh").notNull(),
  keysAuth: text("keys_auth").notNull(),
  createdAt: createdAt(),
});

/** Expo mobile push tokens — one row per (user, device). Created in sql/0011_push_tokens.sql. */
export const pushTokens = pgTable(
  "push_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    deviceId: text("device_id"),
    createdAt: createdAt(),
  },
  (t) => ({ uq: uniqueIndex("push_tokens_user_token_uq").on(t.userId, t.token) }),
);

/**
 * Referral reward credits (H13) — append-only ledger of free months a referrer EARNED at referral
 * milestones. One row per (user, milestone reason); idempotent reconciliation via the unique index.
 * Created in sql/0018_referral_credits.sql (RLS: per-user isolation, grocery_app role).
 */
export const referralCredits = pgTable(
  "referral_credits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    months: integer("months").notNull(),
    reason: text("reason").notNull(),
    createdAt: createdAt(),
  },
  (t) => ({ uq: uniqueIndex("referral_credits_user_reason_uq").on(t.userId, t.reason) }),
);

// ---------------------------------------------------------------------------
// Shared household — opt-in shared shopping list (FEATURE_HOUSEHOLDS, default OFF).
// Members (users whose `users.householdId` points here) share ONE active shopping list. Entirely
// behind the flag: with it off, no household is ever created and these tables stay empty, so existing
// per-user behavior is unchanged. RLS for cross-member access is added in sql/0005_households.sql.
// ---------------------------------------------------------------------------
export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").default("Household").notNull(),
  // The creator; kept for display/ownership. Membership itself is via users.householdId.
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

/** A one-time, unguessable invite link to join a household (token = randomBytes(18).base64url). */
export const householdInvites = pgTable(
  "household_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    expiresAt: ts("expires_at"), // nullable: no expiry
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({ byHousehold: index("household_invite_household_idx").on(t.householdId) }),
);

// ---------------------------------------------------------------------------
// Units & the canonical catalog (the crux — PLAN §4.1)
// ---------------------------------------------------------------------------
export const unitsOfMeasure = pgTable("units_of_measure", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(), // g, kg, oz, lb, ml, l, fl_oz, cup, each, ...
  name: text("name").notNull(),
  dimension: unitDimensionEnum("dimension").notNull(),
  /** Factor to the dimension's base unit (e.g. kg→1000 g). NULL for DISCRETE/COUNT roots. */
  toBaseFactor: numeric("to_base_factor", { precision: 16, scale: 6 }),
  isMetric: boolean("is_metric").default(false).notNull(),
});

export const canonicalItems = pgTable(
  "canonical_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    domain: domainEnum("domain").default("grocery").notNull(),
    category: text("category"), // produce/dairy/meat/pantry/cleaning/skincare/supplements/...
    baseUnitId: uuid("base_unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id),
    // Units per retail package (e.g. 60 capsules/bottle) — powers dosage-based depletion (§6).
    unitsPerPackage: qty("units_per_package"),
    shelfLifePantryDays: integer("shelf_life_pantry_days"),
    shelfLifeFridgeDays: integer("shelf_life_fridge_days"),
    shelfLifeFreezerDays: integer("shelf_life_freezer_days"),
    perishability: perishabilityEnum("perishability").default("shelf_stable").notNull(),
    embedding: vector("embedding"),
    aliases: text("aliases").array().notNull().default(sql`'{}'`),
    isStaple: boolean("is_staple").default(false).notNull(),
    fdcId: integer("fdc_id"), // USDA FoodData Central
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    byDomain: index("canonical_domain_idx").on(t.domain),
    // pg_trgm GIN on name + a HNSW index on embedding are added in sql/0001_indexes.sql.
  }),
);

export const itemUnitConversions = pgTable(
  "item_unit_conversions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalItemId: uuid("canonical_item_id")
      .notNull()
      .references(() => canonicalItems.id, { onDelete: "cascade" }),
    fromUnitId: uuid("from_unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id),
    toUnitId: uuid("to_unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id),
    factor: numeric("factor", { precision: 16, scale: 6 }).notNull(),
    source: conversionSourceEnum("source").default("heuristic").notNull(),
    confidence: real("confidence").default(0.7).notNull(),
  },
  (t) => ({
    byItem: index("conv_item_idx").on(t.canonicalItemId),
    uq: uniqueIndex("conv_item_from_to_uq").on(t.canonicalItemId, t.fromUnitId, t.toUnitId),
  }),
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalItemId: uuid("canonical_item_id")
      .notNull()
      .references(() => canonicalItems.id),
    upc: text("upc"),
    gtin: text("gtin"),
    brand: text("brand"),
    displayName: text("display_name").notNull(),
    retailer: retailerEnum("retailer").default("other").notNull(),
    packageQty: qty("package_qty"),
    packageUnitId: uuid("package_unit_id").references(() => unitsOfMeasure.id),
    packCount: integer("pack_count").default(1).notNull(),
    imageUrl: text("image_url"),
    instacartProductId: text("instacart_product_id"),
    asin: text("asin"), // Amazon vertical (PLAN §7.5)
    subscribeSaveEligible: boolean("subscribe_save_eligible"),
    lastSeenPriceCents: integer("last_seen_price_cents"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    byCanonical: index("product_canonical_idx").on(t.canonicalItemId),
    byUpc: index("product_upc_idx").on(t.upc),
    byAsin: index("product_asin_idx").on(t.asin),
  }),
);

// ---------------------------------------------------------------------------
// Purchases / ingestion (PLAN §5)
// ---------------------------------------------------------------------------
export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: purchaseSourceEnum("source").notNull(),
    retailer: retailerEnum("retailer").default("other").notNull(),
    externalOrderId: text("external_order_id"),
    gmailMessageId: text("gmail_message_id"),
    purchasedAt: ts("purchased_at"),
    totalCents: integer("total_cents"),
    currency: text("currency").default("USD").notNull(),
    rawBlobUrl: text("raw_blob_url"), // S3 pointer to the EML/HTML
    status: purchaseStatusEnum("status").default("parsed").notNull(),
    parseConfidence: real("parse_confidence"),
    parserModel: text("parser_model"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    // Idempotent ingestion: one Gmail message → one Purchase per user.
    byGmailMsg: uniqueIndex("purchase_user_gmail_uq").on(t.userId, t.gmailMessageId),
    byUser: index("purchase_user_idx").on(t.userId),
  }),
);

export const purchaseLineItems = pgTable(
  "purchase_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id),
    canonicalItemId: uuid("canonical_item_id").references(() => canonicalItems.id),
    rawText: text("raw_text").notNull(),
    rawQty: text("raw_qty"),
    rawUnitText: text("raw_unit_text"),
    parsedQty: qty("parsed_qty"),
    parsedUnitId: uuid("parsed_unit_id").references(() => unitsOfMeasure.id),
    baseQty: qty("base_qty"), // normalized to the canonical base unit — the number pantry math uses
    unitPriceCents: integer("unit_price_cents"),
    lineTotalCents: integer("line_total_cents"),
    matchConfidence: real("match_confidence"),
    matchMethod: matchMethodEnum("match_method"),
    needsReview: boolean("needs_review").default(false).notNull(),
    createdAt: createdAt(),
  },
  (t) => ({ byPurchase: index("lineitem_purchase_idx").on(t.purchaseId) }),
);

// ---------------------------------------------------------------------------
// Pantry: projection (PantryStock) + append-only ledger (PLAN §6)
// ---------------------------------------------------------------------------
export const pantryStock = pgTable(
  "pantry_stock",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    canonicalItemId: uuid("canonical_item_id")
      .notNull()
      .references(() => canonicalItems.id),
    baseQtyOnHand: qty("base_qty_on_hand").default("0").notNull(),
    confidence: real("confidence").default(0.7).notNull(),
    lastPurchaseAt: ts("last_purchase_at"),
    lastConfirmedAt: ts("last_confirmed_at"),
    estimatedRunOutAt: ts("estimated_run_out_at"),
    estimatedConsumptionRatePerDay: numeric("est_consumption_rate_per_day", { precision: 16, scale: 6 }),
    openedAt: ts("opened_at"),
    status: stockStatusEnum("status").default("in_stock").notNull(),
    source: stockSourceEnum("source").default("derived").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => ({ uq: uniqueIndex("pantry_user_item_uq").on(t.userId, t.canonicalItemId) }),
);

/** Append-only event log. PantryStock is the materialized projection of this. */
export const stockLedger = pgTable(
  "stock_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    canonicalItemId: uuid("canonical_item_id")
      .notNull()
      .references(() => canonicalItems.id),
    eventType: ledgerEventEnum("event_type").notNull(),
    baseQtyDelta: qty("base_qty_delta").notNull(),
    confidence: real("confidence").default(1).notNull(),
    refType: text("ref_type"), // "purchase_line_item" | "meal_log" | "pantry_scan_detection" | ...
    refId: uuid("ref_id"),
    note: text("note"),
    occurredAt: ts("occurred_at").defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (t) => ({ byUserItem: index("ledger_user_item_idx").on(t.userId, t.canonicalItemId) }),
);

export const consumptionEvents = pgTable("consumption_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  canonicalItemId: uuid("canonical_item_id")
    .notNull()
    .references(() => canonicalItems.id),
  baseQty: qty("base_qty").notNull(),
  method: consumptionMethodEnum("method").notNull(),
  confidence: real("confidence").default(0.5).notNull(),
  occurredAt: ts("occurred_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Vision pantry/fridge scan (PLAN §5.6)
// ---------------------------------------------------------------------------
export const pantryScans = pgTable("pantry_scans", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  capturedAt: ts("captured_at").defaultNow().notNull(),
  location: scanLocationEnum("location").default("fridge").notNull(),
  imageBlobUrls: text("image_blob_urls").array().notNull().default(sql`'{}'`),
  model: text("model"),
  status: scanStatusEnum("status").default("processing").notNull(),
  detectionConfidence: real("detection_confidence"),
  summary: text("summary"),
  createdAt: createdAt(),
});

export const pantryScanDetections = pgTable(
  "pantry_scan_detections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pantryScanId: uuid("pantry_scan_id")
      .notNull()
      .references(() => pantryScans.id, { onDelete: "cascade" }),
    canonicalItemId: uuid("canonical_item_id").references(() => canonicalItems.id),
    rawLabel: text("raw_label").notNull(),
    qtyEstimate: qty("qty_estimate"),
    unitGuess: text("unit_guess"),
    boundingBox: jsonb("bounding_box"),
    presenceConfidence: real("presence_confidence").default(0.5).notNull(),
    qtyConfidence: real("qty_confidence").default(0.3).notNull(),
    matchMethod: matchMethodEnum("match_method"),
    action: detectionActionEnum("action"),
    userConfirmed: boolean("user_confirmed").default(false).notNull(),
  },
  (t) => ({ byScan: index("detection_scan_idx").on(t.pantryScanId) }),
);

// ---------------------------------------------------------------------------
// Recipes (PLAN §7.2) + effort/cleanup dimension (§7.4)
// ---------------------------------------------------------------------------
export const recipes = pgTable("recipes", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: recipeProviderEnum("provider").notNull(),
  externalId: text("external_id"),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  servings: integer("servings"),
  readyMinutes: integer("ready_minutes"),
  handsOnMinutes: integer("hands_on_minutes"),
  cleanupLoad: cleanupLoadEnum("cleanup_load"),
  effortScore: real("effort_score"), // 0..1, lower = easier (estimated by Flash-Lite, cached)
  onePan: boolean("one_pan").default(false).notNull(),
  sheetPan: boolean("sheet_pan").default(false).notNull(),
  noCook: boolean("no_cook").default(false).notNull(),
  leftoverFriendly: boolean("leftover_friendly").default(false).notNull(),
  equipmentNeeded: text("equipment_needed").array().notNull().default(sql`'{}'`),
  instructions: jsonb("instructions"),
  cuisines: text("cuisines").array().notNull().default(sql`'{}'`),
  dishTypes: text("dish_types").array().notNull().default(sql`'{}'`),
  diets: text("diets").array().notNull().default(sql`'{}'`),
  nutrition: jsonb("nutrition"),
  sourceUrl: text("source_url"),
  popularityScore: real("popularity_score"),
  createdAt: createdAt(),
});

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    canonicalItemId: uuid("canonical_item_id").references(() => canonicalItems.id),
    rawText: text("raw_text").notNull(),
    qty: qty("qty"),
    unitId: uuid("unit_id").references(() => unitsOfMeasure.id),
    baseQty: qty("base_qty"),
    isOptional: boolean("is_optional").default(false).notNull(),
    aisle: text("aisle"),
  },
  (t) => ({ byRecipe: index("ingredient_recipe_idx").on(t.recipeId) }),
);

export const mealLogs = pgTable("meal_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  recipeId: uuid("recipe_id").references(() => recipes.id),
  freeText: text("free_text"),
  servingsMade: real("servings_made"),
  mealType: text("meal_type"), // breakfast | lunch | dinner | snack
  cookedAt: ts("cooked_at").defaultNow().notNull(),
  decrementedPantry: boolean("decremented_pantry").default(false).notNull(),
  // Stored macros for the cooked meal (best-effort; nullable when estimation couldn't answer).
  // Computed at log time from USDA FoodData Central (primary) with an LLM fallback — see
  // @gm/core/nutrition. macrosSource records provenance: fdc | llm | mixed | none.
  kcal: real("kcal"),
  proteinG: real("protein_g"),
  carbsG: real("carbs_g"),
  fatG: real("fat_g"),
  macrosSource: text("macros_source"),
});

// ---------------------------------------------------------------------------
// Shopping list + reorder (PLAN §7.1, §7.5)
// ---------------------------------------------------------------------------
export const shoppingLists = pgTable("shopping_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Opt-in shared household (FEATURE_HOUSEHOLDS). When set, every member of the household shares this
  // list — RLS admits members via this column (see sql/0005_households.sql). NULL ⇒ a solo per-user
  // list, the existing/default behavior. The FK is added in that same migration.
  householdId: uuid("household_id").references(() => households.id, { onDelete: "set null" }),
  name: text("name").default("Shopping list").notNull(),
  status: shoppingListStatusEnum("status").default("active").notNull(),
  generatedBy: shoppingListGenByEnum("generated_by").default("reorder_engine").notNull(),
  retailer: retailerEnum("retailer").default("instacart").notNull(),
  instacartPageUrl: text("instacart_page_url"),
  amazonCartUrl: text("amazon_cart_url"),
  pushedAt: ts("pushed_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const shoppingListItems = pgTable(
  "shopping_list_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shoppingListId: uuid("shopping_list_id")
      .notNull()
      .references(() => shoppingLists.id, { onDelete: "cascade" }),
    canonicalItemId: uuid("canonical_item_id")
      .notNull()
      .references(() => canonicalItems.id),
    productId: uuid("product_id").references(() => products.id),
    qty: qty("qty"),
    unitId: uuid("unit_id").references(() => unitsOfMeasure.id),
    reason: shoppingItemReasonEnum("reason").default("manual").notNull(),
    checked: boolean("checked").default(false).notNull(),
  },
  (t) => ({ byList: index("shopitem_list_idx").on(t.shoppingListId) }),
);

export const reorderPolicies = pgTable(
  "reorder_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    canonicalItemId: uuid("canonical_item_id")
      .notNull()
      .references(() => canonicalItems.id),
    isStaple: boolean("is_staple").default(false).notNull(),
    targetParQty: qty("target_par_qty"),
    reorderPointQty: qty("reorder_point_qty"),
    // Per-user dosage (e.g. 2 capsules/day) — deterministic depletion that beats cadence and works
    // from the first package, before any purchase history exists (§6).
    dosesPerDay: qty("doses_per_day"),
    leadTimeDays: integer("lead_time_days").default(2).notNull(),
    minIntervalDays: integer("min_interval_days").default(7).notNull(),
    preferredProductId: uuid("preferred_product_id").references(() => products.id),
    enabled: boolean("enabled").default(true).notNull(),
    updatedAt: updatedAt(),
  },
  (t) => ({ uq: uniqueIndex("reorder_user_item_uq").on(t.userId, t.canonicalItemId) }),
);

export const reorderPredictions = pgTable(
  "reorder_predictions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    canonicalItemId: uuid("canonical_item_id")
      .notNull()
      .references(() => canonicalItems.id),
    predictedRunOutAt: ts("predicted_run_out_at"),
    consumptionRatePerDay: numeric("consumption_rate_per_day", { precision: 16, scale: 6 }),
    recommendQty: qty("recommend_qty"),
    recommendByDate: ts("recommend_by_date"),
    confidence: real("confidence"),
    rationale: text("rationale"),
    computedAt: ts("computed_at").defaultNow().notNull(),
    supersededAt: ts("superseded_at"),
  },
  (t) => ({ byUser: index("prediction_user_idx").on(t.userId) }),
);

// ---------------------------------------------------------------------------
// Personalization: UserModel projection + PreferenceSignal ledger (PLAN §8.7)
// ---------------------------------------------------------------------------
export const userModels = pgTable("user_models", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  diets: text("diets").array().notNull().default(sql`'{}'`),
  allergens: text("allergens").array().notNull().default(sql`'{}'`),
  dislikedItemIds: uuid("disliked_item_ids").array().notNull().default(sql`'{}'`),
  lovedItemIds: uuid("loved_item_ids").array().notNull().default(sql`'{}'`),
  cuisineAffinity: jsonb("cuisine_affinity"), // { cuisine: score }
  spiceTolerance: integer("spice_tolerance"), // 0..5
  cookingSkill: integer("cooking_skill"), // 0..5
  kitchenEquipment: text("kitchen_equipment").array().notNull().default(sql`'{}'`),
  household: jsonb("household"), // { size, kids, pickyEaters }
  qualityPrefs: jsonb("quality_prefs"), // { organic, grassFed, storeBrand, ... }
  mealTimesByType: jsonb("meal_times_by_type"), // { breakfast, lunch, dinner }
  eatsVsTakeoutByDay: jsonb("eats_vs_takeout_by_day"),
  seasonality: jsonb("seasonality"),
  effortToleranceBaseline: real("effort_tolerance_baseline"),
  busyDays: text("busy_days").array().notNull().default(sql`'{}'`),
  weeklyBudgetCents: integer("weekly_budget_cents"),
  healthGoals: text("health_goals").array().notNull().default(sql`'{}'`),
  brandPrefs: jsonb("brand_prefs"),
  defaultRetailer: retailerEnum("default_retailer").default("instacart").notNull(),
  confidencePerField: jsonb("confidence_per_field"),
  updatedAt: updatedAt(),
});

/** Append-only preference ledger; UserModel is its projection (the ratchet, applied to *you*). */
export const preferenceSignals = pgTable(
  "preference_signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(), // e.g. "cuisine:thai", "ingredient:cilantro", "quality:organic"
    value: text("value"),
    polarity: prefPolarityEnum("polarity").default("neutral").notNull(),
    source: prefSourceEnum("source").notNull(),
    confidence: real("confidence").default(0.5).notNull(),
    occurredAt: ts("occurred_at").defaultNow().notNull(),
  },
  (t) => ({ byUser: index("prefsignal_user_idx").on(t.userId) }),
);

/** User corrections that train the matcher — consulted first on future matches. */
export const ingredientMatchOverrides = pgTable(
  "ingredient_match_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rawText: text("raw_text"),
    upc: text("upc"),
    canonicalItemId: uuid("canonical_item_id")
      .notNull()
      .references(() => canonicalItems.id),
    createdAt: createdAt(),
  },
  (t) => ({ byUserRaw: index("override_user_raw_idx").on(t.userId, t.rawText) }),
);

// ---------------------------------------------------------------------------
// A few relations (the rest can use explicit joins)
// ---------------------------------------------------------------------------
export const canonicalItemRelations = relations(canonicalItems, ({ many, one }) => ({
  products: many(products),
  conversions: many(itemUnitConversions),
  baseUnit: one(unitsOfMeasure, {
    fields: [canonicalItems.baseUnitId],
    references: [unitsOfMeasure.id],
  }),
}));

export const productRelations = relations(products, ({ one }) => ({
  canonicalItem: one(canonicalItems, {
    fields: [products.canonicalItemId],
    references: [canonicalItems.id],
  }),
}));

export const purchaseRelations = relations(purchases, ({ many }) => ({
  lineItems: many(purchaseLineItems),
}));

export const purchaseLineItemRelations = relations(purchaseLineItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseLineItems.purchaseId],
    references: [purchases.id],
  }),
}));
