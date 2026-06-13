/**
 * Read-model query helpers for the UI (PLAN §5/§7). Kept in @gm/db so the web app stays
 * thin (no direct Drizzle import). Per-user; userId optional until Auth is wired.
 */
import { and, desc, eq } from "drizzle-orm";
import type { DB } from "./client.js";
import {
  canonicalItems,
  oauthCredentials,
  pantryStock,
  purchaseLineItems,
  purchases,
  reorderPolicies,
  users,
} from "./schema.js";

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
export async function upsertGoogleAuth(db: DB, a: GoogleAuthUpsert): Promise<string> {
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
export async function getGoogleCredential(db: DB, userId: string) {
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
export async function listGoogleUserIds(db: DB): Promise<string[]> {
  const rows = await db
    .select({ userId: oauthCredentials.userId })
    .from(oauthCredentials)
    .where(eq(oauthCredentials.provider, "google"));
  return rows.map((r) => r.userId);
}

export async function updateGoogleTokens(
  db: DB,
  userId: string,
  a: { accessTokenEnc: string; expiresAt: Date | null },
) {
  await db
    .update(oauthCredentials)
    .set({ accessTokenEnc: a.accessTokenEnc, expiresAt: a.expiresAt, updatedAt: new Date() })
    .where(and(eq(oauthCredentials.userId, userId), eq(oauthCredentials.provider, "google")));
}

export async function setGmailHistoryId(db: DB, userId: string, historyId: string) {
  await db
    .update(oauthCredentials)
    .set({ historyId, updatedAt: new Date() })
    .where(and(eq(oauthCredentials.userId, userId), eq(oauthCredentials.provider, "google")));
}

/** Demo helper until Auth.js is wired: the most recently created user. */
export async function getLatestUserId(db: DB): Promise<string | null> {
  const rows = await db.select({ id: users.id }).from(users).orderBy(desc(users.createdAt)).limit(1);
  return rows[0]?.id ?? null;
}

export async function getPantryView(db: DB, userId: string) {
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

export async function getReviewQueue(db: DB, userId: string) {
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
export async function loadReorderInputs(db: DB, userId: string) {
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
    packageQty: null as number | null,
    asin: null as string | null,
  }));
}
