/**
 * Read-model query helpers for the UI (PLAN §5/§7). Kept in @gm/db so the web app stays
 * thin (no direct Drizzle import). Per-user; userId optional until Auth is wired.
 */
import { and, desc, eq } from "drizzle-orm";
import type { DB } from "./client.js";
import { canonicalItems, pantryStock, purchaseLineItems, purchases, users } from "./schema.js";

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
