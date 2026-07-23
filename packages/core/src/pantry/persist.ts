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

/** Provenance of the current projection. Mirrors the `stock_source` enum. */
export type StockSource = "derived" | "user_confirmed";

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
  /**
   * Marks the resulting projection as `user_confirmed` (an explicit "it's here" from the user, e.g.
   * a reviewed vision scan) rather than the default `derived`. Omitted → the projection's existing
   * source is preserved (a routine reprojection never downgrades a confirmed item back to derived).
   */
  source?: StockSource;
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
  return reprojectStock(db, a.userId, a.canonicalItemId, a.ratePerDay ?? null, a.source);
}

/**
 * Recompute PantryStock for one (user, item) from its full ledger and upsert it. `source`, when
 * given, stamps the projection's provenance (`user_confirmed`); omitting it leaves an existing row's
 * source untouched and defaults a new row to `derived` — so the projection stays a pure function of
 * the ledger and stock is NEVER written outside this path (the §6 ledger-only invariant).
 */
export async function reprojectStock(
  db: Querier,
  userId: string,
  canonicalItemId: string,
  ratePerDay: number | null,
  source?: StockSource,
) {
  // The ledger events and the item's shelf-life metadata are independent reads — dispatch them
  // together instead of awaiting one before issuing the other. postgres.js still serializes both
  // statements on the tenant's reserved connection (in call order), so this doesn't cut a wire
  // round-trip; it removes the JS-side await stall between them. reprojectStock runs on the hottest
  // write path (once per purchase line item, once per recipe-cook ingredient), so the saved stall
  // compounds. Same pattern already used in ask/actions.ts.
  const [events, itemRows] = await Promise.all([
    db
      .select({
        delta: stockLedger.baseQtyDelta,
        occurredAt: stockLedger.occurredAt,
        eventType: stockLedger.eventType,
      })
      .from(stockLedger)
      .where(and(eq(stockLedger.userId, userId), eq(stockLedger.canonicalItemId, canonicalItemId))),
    db
      .select({
        perishability: canonicalItems.perishability,
        fridge: canonicalItems.shelfLifeFridgeDays,
        pantryDays: canonicalItems.shelfLifePantryDays,
      })
      .from(canonicalItems)
      .where(eq(canonicalItems.id, canonicalItemId))
      .limit(1),
  ]);
  const item = itemRows[0];

  const mapped = events.map((e) => ({ baseQtyDelta: Number(e.delta), occurredAt: e.occurredAt }));

  // "Bought" = the last time stock was actually ADDED (a positive delta: purchase / manual add / vision
  // new-item). A zero-delta confirmation must NOT shift this, so the displayed acquisition date stays true.
  const acquisitions = events.filter((e) => Number(e.delta) > 0).map((e) => e.occurredAt.getTime());
  const lastPurchaseAt = acquisitions.length > 0 ? new Date(Math.max(...acquisitions)) : null;

  // "Confirmed" = the last explicit "it's here" signal (a vision confirm, or a zero-delta manual
  // "still have it"). This re-grounds the spoilage clock WITHOUT pretending the item was just bought.
  const confirmations = events
    .filter((e) => e.eventType === "vision_confirmed" || Number(e.delta) === 0)
    .map((e) => e.occurredAt.getTime());
  const lastConfirmedAt = confirmations.length > 0 ? new Date(Math.max(...confirmations)) : null;

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
    lastConfirmedAt,
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
    lastConfirmedAt,
    // Only stamp source when the caller asserts it (user confirmation). Omitting it lets a new row
    // default to "derived" and leaves an existing row's source unchanged on reprojection.
    ...(source ? { source } : {}),
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
