/**
 * Read-model query helpers for the UI (PLAN §5/§7). Kept in @gm/db so the web app stays
 * thin (no direct Drizzle import). Per-user; userId optional until Auth is wired.
 */
import { and, desc, eq } from "drizzle-orm";
import type { DB } from "./client.js";
import {
  canonicalItems,
  pantryStock,
  purchaseLineItems,
  purchases,
  reorderPolicies,
  users,
} from "./schema.js";

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
