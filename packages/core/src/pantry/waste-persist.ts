/**
 * Record waste (PLAN §10) — the "went bad / tossed it" action. Must run inside withTenant. It:
 *   1. zeroes the remaining stock with a `spoilage` ledger event (preserving the learned rate),
 *   2. appends a weak negative taste signal (the ratchet, source "waste"), and
 *   3. auto-tunes the item's reorder par DOWN so the engine learns to buy less of what you waste.
 * Absence-of-precision honesty: it never invents a $ value here — cost lives in the read summary.
 */
import { and, eq } from "drizzle-orm";
import { appendPreferenceSignal, pantryStock, reorderPolicies, type Querier } from "@gm/db";
import { signalFromWaste } from "../personalization/user-model.js";
import { tuneParForWaste } from "../reorder/par-tuning.js";
import { appendLedgerAndReproject } from "./persist.js";

export interface RecordWasteResult {
  wastedBaseQty: number;
  parLowered: boolean;
  newTargetParQty: number | null;
}

export async function recordWaste(
  db: Querier,
  userId: string,
  canonicalItemId: string,
  itemName?: string | null,
): Promise<RecordWasteResult> {
  const now = new Date();

  const [stock] = await db
    .select({ onHand: pantryStock.baseQtyOnHand, rate: pantryStock.estimatedConsumptionRatePerDay })
    .from(pantryStock)
    .where(and(eq(pantryStock.userId, userId), eq(pantryStock.canonicalItemId, canonicalItemId)))
    .limit(1);
  const onHand = stock ? Number(stock.onHand) : 0;
  const rate = stock?.rate != null ? Number(stock.rate) : null;

  // 1. Spoilage zeroes the remaining stock; reproject preserves the learned consumption rate.
  await appendLedgerAndReproject(db, {
    userId,
    canonicalItemId,
    baseQtyDelta: -Math.max(0, onHand),
    eventType: "spoilage",
    confidence: 0.9,
    occurredAt: now,
    ratePerDay: rate,
  });

  // 2. Weak negative taste signal (the learning ratchet applied to you).
  const sig = signalFromWaste((itemName ?? canonicalItemId).toLowerCase());
  await appendPreferenceSignal(db, {
    userId,
    topic: sig.topic,
    value: sig.value ?? null,
    polarity: sig.polarity,
    source: "waste",
    confidence: sig.confidence,
  });

  // 3. Auto-tune the par down if this item is on a reorder policy.
  const [pol] = await db
    .select({ target: reorderPolicies.targetParQty, rp: reorderPolicies.reorderPointQty })
    .from(reorderPolicies)
    .where(and(eq(reorderPolicies.userId, userId), eq(reorderPolicies.canonicalItemId, canonicalItemId)))
    .limit(1);

  let parLowered = false;
  let newTargetParQty: number | null = null;
  if (pol) {
    const tuned = tuneParForWaste({
      targetParQty: pol.target != null ? Number(pol.target) : null,
      reorderPointQty: pol.rp != null ? Number(pol.rp) : null,
    });
    if (tuned) {
      await db
        .update(reorderPolicies)
        .set({
          targetParQty: String(tuned.targetParQty),
          reorderPointQty: String(tuned.reorderPointQty),
          updatedAt: now,
        })
        .where(
          and(eq(reorderPolicies.userId, userId), eq(reorderPolicies.canonicalItemId, canonicalItemId)),
        );
      parLowered = true;
      newTargetParQty = tuned.targetParQty;
    }
  }

  return { wastedBaseQty: Math.max(0, onHand), parLowered, newTargetParQty };
}
