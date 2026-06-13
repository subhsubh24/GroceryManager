/**
 * Spend & price intelligence (PLAN §10) — pure aggregation over already-parsed receipt data.
 * No external key. Money stays in integer cents; callers convert numeric columns to numbers.
 */

function periodStartUTC(d: Date, period: "week" | "month"): string {
  if (period === "month") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
  }
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const mondayOffset = (dt.getUTCDay() + 6) % 7; // 0 = Monday
  dt.setUTCDate(dt.getUTCDate() - mondayOffset);
  return dt.toISOString().slice(0, 10);
}

export interface SpendPeriod {
  periodStart: string;
  totalCents: number;
}

/** Total spend grouped by UTC week/month, newest period first. */
export function spendByPeriod(
  rows: { purchasedAt: Date; totalCents: number | null }[],
  period: "week" | "month",
): SpendPeriod[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.totalCents == null) continue;
    const k = periodStartUTC(r.purchasedAt, period);
    map.set(k, (map.get(k) ?? 0) + r.totalCents);
  }
  return [...map.entries()]
    .map(([periodStart, totalCents]) => ({ periodStart, totalCents }))
    .sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));
}

export interface ItemSpend {
  canonicalItemId: string;
  name: string;
  totalCents: number;
}

export function topItemsBySpend(
  lines: { canonicalItemId: string; name: string; lineTotalCents: number | null }[],
  limit = 10,
): ItemSpend[] {
  const map = new Map<string, ItemSpend>();
  for (const l of lines) {
    if (l.lineTotalCents == null) continue;
    const cur = map.get(l.canonicalItemId) ?? { canonicalItemId: l.canonicalItemId, name: l.name, totalCents: 0 };
    cur.totalCents += l.lineTotalCents;
    map.set(l.canonicalItemId, cur);
  }
  return [...map.values()].sort((a, b) => b.totalCents - a.totalCents).slice(0, limit);
}

export interface UnitPriceTrend {
  canonicalItemId: string;
  name: string;
  latestCents: number;
  avgCents: number;
  minCents: number;
  maxCents: number;
  points: { at: string; cents: number }[];
}

export function unitPriceTrends(
  lines: { canonicalItemId: string; name: string; unitPriceCents: number | null; purchasedAt: Date }[],
): UnitPriceTrend[] {
  const byItem = new Map<string, { name: string; pts: { at: Date; cents: number }[] }>();
  for (const l of lines) {
    if (l.unitPriceCents == null) continue;
    const e = byItem.get(l.canonicalItemId) ?? { name: l.name, pts: [] };
    e.pts.push({ at: l.purchasedAt, cents: l.unitPriceCents });
    byItem.set(l.canonicalItemId, e);
  }
  const out: UnitPriceTrend[] = [];
  for (const [id, e] of byItem) {
    const pts = e.pts.sort((a, b) => a.at.getTime() - b.at.getTime());
    const cents = pts.map((p) => p.cents);
    out.push({
      canonicalItemId: id,
      name: e.name,
      latestCents: cents[cents.length - 1]!,
      avgCents: Math.round(cents.reduce((s, c) => s + c, 0) / cents.length),
      minCents: Math.min(...cents),
      maxCents: Math.max(...cents),
      points: pts.map((p) => ({ at: p.at.toISOString().slice(0, 10), cents: p.cents })),
    });
  }
  return out;
}

export interface CheaperRetailer {
  canonicalItemId: string;
  name: string;
  bestRetailer: string;
  bestCents: number;
  savingsVsWorstCents: number;
}

/** Per item bought at ≥2 retailers, the cheapest avg unit price + savings vs the priciest. */
export function cheaperRetailer(
  lines: { canonicalItemId: string; name: string; retailer: string; unitPriceCents: number | null }[],
): CheaperRetailer[] {
  const agg = new Map<string, Map<string, { sum: number; n: number }>>();
  const names = new Map<string, string>();
  for (const l of lines) {
    if (l.unitPriceCents == null) continue;
    names.set(l.canonicalItemId, l.name);
    const m = agg.get(l.canonicalItemId) ?? new Map<string, { sum: number; n: number }>();
    const cur = m.get(l.retailer) ?? { sum: 0, n: 0 };
    cur.sum += l.unitPriceCents;
    cur.n += 1;
    m.set(l.retailer, cur);
    agg.set(l.canonicalItemId, m);
  }
  const out: CheaperRetailer[] = [];
  for (const [id, m] of agg) {
    if (m.size < 2) continue;
    const avgs = [...m.entries()]
      .map(([retailer, v]) => ({ retailer, cents: Math.round(v.sum / v.n) }))
      .sort((a, b) => a.cents - b.cents);
    const best = avgs[0]!;
    const worst = avgs[avgs.length - 1]!;
    out.push({
      canonicalItemId: id,
      name: names.get(id) ?? "",
      bestRetailer: best.retailer,
      bestCents: best.cents,
      savingsVsWorstCents: worst.cents - best.cents,
    });
  }
  return out.sort((a, b) => b.savingsVsWorstCents - a.savingsVsWorstCents);
}

export interface BudgetStatus {
  actualCents: number;
  budgetCents: number | null;
  deltaCents: number | null;
  overBudget: boolean;
}

export function budgetVsActual(actualCents: number, weeklyBudgetCents?: number | null): BudgetStatus {
  if (weeklyBudgetCents == null) return { actualCents, budgetCents: null, deltaCents: null, overBudget: false };
  const delta = actualCents - weeklyBudgetCents;
  return { actualCents, budgetCents: weeklyBudgetCents, deltaCents: delta, overBudget: delta > 0 };
}
