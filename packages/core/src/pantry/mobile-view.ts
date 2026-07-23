/**
 * Mobile pantry list DTO — the shape the native app's Pantry screen renders.
 *
 * The native app reads this over an untyped JSON boundary (the `/api/mobile/pantry` route), so the
 * server-side row shape (`getPantryView`) and the client-side render shape MUST be reconciled here in
 * one pure, tested place. Mirrors the WEB pantry surface exactly: the on-hand figure is the whole
 * base-unit quantity ("N on hand") and the countdown is a projected RUN-OUT (consumption), never an
 * "expiry" — run-out is a prediction, not a spoilage date, and the copy must not overclaim.
 */

const DAY_MS = 86_400_000;

/** The subset of a `getPantryView` row this mapper needs (structurally compatible with the query). */
export interface MobilePantryRow {
  canonicalItemId: string;
  name: string;
  /** Numeric column — Drizzle surfaces `numeric` as a string, so coerce. */
  baseQtyOnHand: number | string;
  status: string;
  estimatedRunOutAt?: Date | string | null;
}

export interface MobilePantryItem {
  /** Stable list key — the canonical item id (NOT a per-row `id`, which the view doesn't carry). */
  id: string;
  name: string;
  /** Whole base-unit quantity on hand — mirrors the web "N on hand" figure. */
  quantity: number;
  status: string;
  /** Whole days until projected run-out (≤0 = today/overdue); null when there's no estimate. */
  runsOutInDays: number | null;
}

/**
 * Map raw pantry-view rows into the native app's list DTO. Pure + deterministic given `now`.
 * A missing/invalid on-hand coerces to 0 (never `NaN` on screen); a missing run-out estimate yields
 * `null` so the client can hide the countdown rather than render a bogus one.
 */
export function toMobilePantryItems(rows: MobilePantryRow[], now: Date = new Date()): MobilePantryItem[] {
  return rows.map((r) => {
    const runOut = r.estimatedRunOutAt != null ? new Date(r.estimatedRunOutAt) : null;
    const runsOutInDays =
      runOut && !Number.isNaN(runOut.getTime())
        ? Math.ceil((runOut.getTime() - now.getTime()) / DAY_MS)
        : null;
    const qty = Math.round(Number(r.baseQtyOnHand));
    return {
      id: r.canonicalItemId,
      name: r.name,
      quantity: Number.isFinite(qty) ? qty : 0,
      status: r.status,
      runsOutInDays,
    };
  });
}
