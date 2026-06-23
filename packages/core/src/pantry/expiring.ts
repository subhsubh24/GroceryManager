/**
 * "Use it up" selector (PLAN §10 waste-reduction hub). Pure + tested.
 *
 * Picks the pantry items worth cooking *now* to avoid waste: those past their shelf-life
 * ceiling (`expired_likely`) or projected to run out very soon. This is a spoilage signal,
 * not a quantity one — `low`/`out` belong to the reorder list, not here.
 */

const DAY_MS = 86_400_000;

export interface PantryRowLike {
  canonicalItemId: string;
  name: string;
  aliases?: string[] | null;
  domain?: string | null;
  status: string;
  estimatedRunOutAt?: Date | string | null;
}

export interface ExpiringItem {
  canonicalItemId: string;
  name: string;
  aliases: string[];
  domain: string | null;
  status: string;
  reason: "expired_likely" | "runs_out_soon";
  /** Whole days until projected run-out (≤0 = today/overdue); null if unknown. */
  daysLeft: number | null;
  estimatedRunOutAt: Date | null;
}

export interface SelectExpiringOpts {
  /** Include items projected to run out within this many days (default 5). */
  withinDays?: number;
  now?: Date;
  /** Restrict to one domain (e.g. "grocery" — recipes don't apply to household). */
  domain?: string | null;
  /**
   * Drop confidently-expired items. "Use it up" surfaces set this — you can't cook something that's
   * already gone, so those belong in the pantry's review (still have it? / used / tossed), not here.
   */
  excludeExpired?: boolean;
}

export function selectExpiringSoon(rows: PantryRowLike[], opts: SelectExpiringOpts = {}): ExpiringItem[] {
  const now = opts.now ?? new Date();
  const withinDays = opts.withinDays ?? 5;
  const out: ExpiringItem[] = [];

  for (const r of rows) {
    if (opts.domain && r.domain && r.domain !== opts.domain) continue;
    if (r.status === "out") continue; // nothing left to use up

    const runOut = r.estimatedRunOutAt != null ? new Date(r.estimatedRunOutAt) : null;
    const daysLeft = runOut ? Math.ceil((runOut.getTime() - now.getTime()) / DAY_MS) : null;

    let reason: ExpiringItem["reason"] | null = null;
    if (r.status === "expired_likely") reason = opts.excludeExpired ? null : "expired_likely";
    else if (daysLeft != null && daysLeft <= withinDays) reason = "runs_out_soon";
    if (!reason) continue;

    out.push({
      canonicalItemId: r.canonicalItemId,
      name: r.name,
      aliases: r.aliases ?? [],
      domain: r.domain ?? null,
      status: r.status,
      reason,
      daysLeft,
      estimatedRunOutAt: runOut,
    });
  }

  // Most urgent first: already-expired, then soonest run-out.
  const rank = (e: ExpiringItem) => (e.reason === "expired_likely" ? Number.NEGATIVE_INFINITY : e.daysLeft ?? Number.POSITIVE_INFINITY);
  return out.sort((a, b) => rank(a) - rank(b));
}
