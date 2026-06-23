/**
 * Depletion engine v1 (PLAN §6) — the deterministic core of the "learning pantry".
 *
 * Harness principle: do the math in code; the model only fills gaps. These are pure
 * functions over a ledger projection, so they're exhaustively testable ("time-travel" tests).
 *
 *   estimateOnHand     — project on-hand + status + confidence at any instant `asOf`
 *   ewmaConsumptionRate — learn a per-day consumption rate from purchase cadence (EWMA)
 *   decayConfidence     — confidence decays with time-since-last-known
 */

const DAY_MS = 86_400_000;

export type StockStatus = "in_stock" | "low" | "out" | "expired_likely";

export interface LedgerDelta {
  /** Signed change in base units (+purchase / −consume / correction). */
  baseQtyDelta: number;
  occurredAt: Date;
}

export interface DepletionInput {
  /** All ledger events for one (user, canonical item). */
  events: LedgerDelta[];
  asOf: Date;
  /** Learned consumption rate (base units/day); null disables inferred decay. */
  ratePerDay?: number | null;
  perishable?: boolean;
  shelfLifeDays?: number | null;
  /** When the current stock was last acquired — the base of the spoilage ceiling + the "bought" date. */
  lastPurchaseAt?: Date | null;
  /**
   * When the user/vision last CONFIRMED the item is present. A confirmation re-grounds freshness, so
   * the spoilage clock runs from the later of purchase-or-confirmation — "still have it" un-expires an
   * item without pretending it was just bought. Omit → freshness is measured from the purchase alone.
   */
  lastConfirmedAt?: Date | null;
  /**
   * Grace days past shelf life before we CONFIDENTLY call a perishable `expired_likely`. Inside this
   * window the item isn't auto-expired — it's still in stock but flags as "expiring soon" (use it up),
   * so we review rather than assume. Only well past shelf life (≈3–4 weeks for short-lived foods) does
   * it become a definite expiry.
   */
  graceDays?: number;
  /** Optional reorder point (base units) used to flag `low`. */
  reorderPointQty?: number | null;
  /** Confidence of the last known event/source (PLAN §6). */
  baseConfidence?: number;
  /** Confidence decay time-constant (days). */
  tauDays?: number;
}

export interface DepletionResult {
  baseQtyOnHand: number;
  status: StockStatus;
  confidence: number;
  estimatedRunOutAt: Date | null;
  inferredConsumed: number;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Confidence decays from `base` with elapsed `days` (PLAN §6 confidence model). */
export function decayConfidence(base: number, days: number, tauDays: number): number {
  if (tauDays <= 0) return clamp(base, 0.1, 1);
  return clamp(base * Math.exp(-Math.max(0, days) / tauDays), 0.1, 1);
}

/**
 * EWMA consumption rate (base units/day) from purchase history. Each interval implies a rate
 * (qty bought / days until the next purchase); we EWMA those, most-recent weighted highest.
 * Returns null when there's insufficient history (< 2 purchases).
 */
export function ewmaConsumptionRate(
  purchases: { qty: number; at: Date }[],
  alpha = 0.5,
): number | null {
  if (purchases.length < 2) return null;
  const sorted = [...purchases].sort((a, b) => a.at.getTime() - b.at.getTime());
  let ewma: number | null = null;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const days = (cur.at.getTime() - prev.at.getTime()) / DAY_MS;
    if (days <= 0) continue;
    const rate = prev.qty / days; // prev purchase consumed over the interval to the next
    ewma = ewma == null ? rate : alpha * rate + (1 - alpha) * ewma;
  }
  return ewma;
}

/** Project on-hand quantity, status, and confidence at `asOf`. */
export function estimateOnHand(input: DepletionInput): DepletionResult {
  const {
    events,
    asOf,
    ratePerDay = null,
    perishable = false,
    shelfLifeDays = null,
    lastPurchaseAt = null,
    lastConfirmedAt = null,
    graceDays = 14,
    reorderPointQty = null,
    baseConfidence = 0.85,
    tauDays = 30,
  } = input;

  const onHandAtLast = events.reduce((sum, e) => sum + e.baseQtyDelta, 0);
  const lastEventAt =
    events.length > 0
      ? new Date(Math.max(...events.map((e) => e.occurredAt.getTime())))
      : asOf;

  const days = Math.max(0, (asOf.getTime() - lastEventAt.getTime()) / DAY_MS);

  // Freshness clock: the later of last purchase or last confirmation — confirming "still have it"
  // re-grounds it. A perishable's shelf life dates from here.
  const freshFrom =
    lastConfirmedAt && (!lastPurchaseAt || lastConfirmedAt.getTime() > lastPurchaseAt.getTime())
      ? lastConfirmedAt
      : lastPurchaseAt;
  const ageDays =
    perishable && shelfLifeDays != null && freshFrom != null
      ? (asOf.getTime() - freshFrom.getTime()) / DAY_MS
      : null;
  // Confident expiry ONLY when well past shelf life (+ grace). Inside the grace window we don't
  // assume — the item stays in stock and surfaces as "expiring soon" (use it up) instead.
  const expired = ageDays != null && shelfLifeDays != null && ageDays > shelfLifeDays + graceDays;

  const inferred = ratePerDay && ratePerDay > 0 ? ratePerDay * days : 0;
  const onHand = expired ? 0 : Math.max(0, onHandAtLast - inferred);
  const inferredConsumed = expired ? Math.max(0, onHandAtLast) : Math.max(0, onHandAtLast - onHand);

  let status: StockStatus;
  if (expired) status = "expired_likely";
  else if (onHand <= 0) status = "out";
  else if (reorderPointQty != null && onHand <= reorderPointQty) status = "low";
  else status = "in_stock";

  // Run-out = whichever comes first: consumption emptying it, or a perishable reaching its shelf life.
  // The spoil date gives perishables a real "expiring soon" signal even with no consumption history.
  const spoilAt =
    perishable && shelfLifeDays != null && freshFrom != null
      ? new Date(freshFrom.getTime() + shelfLifeDays * DAY_MS)
      : null;
  const consumeRunOut =
    ratePerDay && ratePerDay > 0 && onHandAtLast > 0
      ? new Date(lastEventAt.getTime() + (onHandAtLast / ratePerDay) * DAY_MS)
      : null;
  const estimatedRunOutAt =
    consumeRunOut && spoilAt
      ? spoilAt.getTime() < consumeRunOut.getTime()
        ? spoilAt
        : consumeRunOut
      : (consumeRunOut ?? spoilAt);

  return {
    baseQtyOnHand: onHand,
    status,
    confidence: decayConfidence(baseConfidence, days, tauDays),
    estimatedRunOutAt,
    inferredConsumed,
  };
}
