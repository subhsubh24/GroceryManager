/**
 * Ledger persistence + reprojection (PLAN §6). Append a StockLedger event, then recompute
 * PantryStock from the full ledger for that (user, item) and upsert the projection.
 */
import { and, eq } from "drizzle-orm";
import type { Querier } from "@gm/db";
import { canonicalItems, pantryStock, stockLedger } from "@gm/db";
import type { LedgerEventType } from "@gm/shared";
import { ewmaConsumptionRate } from "./depletion.js";
import { projectPantryStock } from "./project.js";

export interface LedgerAppend {
  userId: string;
  canonicalItemId: string;
  baseQtyDelta: number;
  eventType: LedgerEventType;
  confidence?: number;
  refType?: string | null;
  refId?: string | null;
  occurredAt?: Date;
  ratePerDay?: number | null;
}

export async function appendLedgerAndReproject(db: Querier, a: LedgerAppend) {
  await db.insert(stockLedger).values({
    userId: a.userId,
    canonicalItemId: a.canonicalItemId,
    baseQtyDelta: String(a.baseQtyDelta),
    eventType: a.eventType,
    confidence: a.confidence ?? 1,
    refType: a.refType ?? null,
    refId: a.refId ?? null,
    occurredAt: a.occurredAt ?? new Date(),
  });
  return reprojectStock(db, a.userId, a.canonicalItemId, a.ratePerDay ?? null);
}

/** Recompute PantryStock for one (user, item) from its full ledger and upsert it. */
export async function reprojectStock(
  db: Querier,
  userId: string,
  canonicalItemId: string,
  ratePerDay: number | null,
) {
  const events = await db
    .select({ delta: stockLedger.baseQtyDelta, occurredAt: stockLedger.occurredAt })
    .from(stockLedger)
    .where(and(eq(stockLedger.userId, userId), eq(stockLedger.canonicalItemId, canonicalItemId)));

  const itemRows = await db
    .select({
      perishability: canonicalItems.perishability,
      fridge: canonicalItems.shelfLifeFridgeDays,
      pantryDays: canonicalItems.shelfLifePantryDays,
    })
    .from(canonicalItems)
    .where(eq(canonicalItems.id, canonicalItemId))
    .limit(1);
  const item = itemRows[0];

  const mapped = events.map((e) => ({ baseQtyDelta: Number(e.delta), occurredAt: e.occurredAt }));
  const lastPurchaseAt =
    mapped.length > 0 ? new Date(Math.max(...mapped.map((m) => m.occurredAt.getTime()))) : null;

  // Learn this item's consumption rate from its own purchase cadence (positive deltas), weighting
  // recent intervals (EWMA), so backfilled history actually depletes toward a realistic "what's left
  // today" instead of sitting at the purchased quantity forever. An explicit caller rate wins; else
  // we derive it (null until there are ≥2 purchases). Also feeds reorder timing.
  const purchases = mapped.filter((m) => m.baseQtyDelta > 0).map((m) => ({ qty: m.baseQtyDelta, at: m.occurredAt }));
  const learnedRate = ratePerDay ?? ewmaConsumptionRate(purchases);

  const proj = projectPantryStock({
    events: mapped,
    asOf: new Date(),
    ratePerDay: learnedRate,
    // Spoilage ceiling applies to anything NOT explicitly shelf-stable — household / canned / dry
    // goods deplete only by use, while perishables + semi-perishables age out after their shelf life.
    perishable: item ? item.perishability !== "shelf_stable" : false,
    shelfLifeDays: item ? (item.fridge ?? item.pantryDays ?? null) : null,
    lastPurchaseAt,
  });

  const rate =
    proj.estimatedConsumptionRatePerDay != null ? String(proj.estimatedConsumptionRatePerDay) : null;
  const values = {
    baseQtyOnHand: String(proj.baseQtyOnHand),
    confidence: proj.confidence,
    status: proj.status,
    estimatedRunOutAt: proj.estimatedRunOutAt,
    estimatedConsumptionRatePerDay: rate,
    lastPurchaseAt,
  };

  await db
    .insert(pantryStock)
    .values({ userId, canonicalItemId, ...values })
    .onConflictDoUpdate({
      target: [pantryStock.userId, pantryStock.canonicalItemId],
      set: { ...values, updatedAt: new Date() },
    });

  return proj;
}
