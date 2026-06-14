/**
 * Waste summary (PLAN §10 waste-reduction hub). Pure + testable: aggregate `spoilage` ledger events
 * into a count + per-item breakdown so the UI can show what's being thrown away and nudge par levels
 * down. Cost is best-effort — only summed when the caller supplies a per-event estimate (precise $
 * needs price × spoiled qty, deferred) — so we never show fake precision.
 */
export interface WasteEvent {
  canonicalItemId: string;
  name: string;
  /** Negative base-unit delta from the spoilage ledger event. */
  baseQtyDelta: number;
  occurredAt: Date;
  /** Optional estimated cost of this wasted item, in cents. */
  estCents?: number | null;
}

export interface WasteByItem {
  canonicalItemId: string;
  name: string;
  count: number;
  wastedCents: number;
}

export interface WasteSummary {
  count: number;
  totalWastedCents: number;
  hasCostData: boolean;
  byItem: WasteByItem[];
}

export function summarizeWaste(events: WasteEvent[]): WasteSummary {
  const byId = new Map<string, WasteByItem>();
  let totalWastedCents = 0;
  let hasCostData = false;

  for (const e of events) {
    const cents = e.estCents ?? 0;
    if (e.estCents != null) hasCostData = true;
    totalWastedCents += cents;

    const prev = byId.get(e.canonicalItemId);
    if (prev) {
      prev.count += 1;
      prev.wastedCents += cents;
    } else {
      byId.set(e.canonicalItemId, {
        canonicalItemId: e.canonicalItemId,
        name: e.name,
        count: 1,
        wastedCents: cents,
      });
    }
  }

  const byItem = [...byId.values()].sort(
    (a, b) => b.count - a.count || b.wastedCents - a.wastedCents || a.name.localeCompare(b.name),
  );

  return { count: events.length, totalWastedCents, hasCostData, byItem };
}
