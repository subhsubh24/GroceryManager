import {
  getDb,
  getLatestUserId,
  getUserBudgetCents,
  loadLineItemsForSpend,
  loadPurchasesForSpend,
} from "@gm/db";
import { budgetVsActual, cheaperRetailer, spendByPeriod, topItemsBySpend } from "@gm/core/spend";

export const dynamic = "force-dynamic";

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const retailerLabel = (r: string) => r.replace(/_/g, " ");

async function load() {
  try {
    const db = getDb();
    const userId = await getLatestUserId(db);
    if (!userId) return { ready: false as const, error: null as string | null };
    const [purchases, lines, budgetCents] = await Promise.all([
      loadPurchasesForSpend(db, userId),
      loadLineItemsForSpend(db, userId),
      getUserBudgetCents(db, userId),
    ]);
    const months = spendByPeriod(purchases, "month");
    const weeks = spendByPeriod(purchases, "week");
    return {
      ready: true as const,
      error: null as string | null,
      empty: purchases.length === 0,
      months,
      thisMonth: months[0]?.totalCents ?? 0,
      budget: budgetVsActual(weeks[0]?.totalCents ?? 0, budgetCents),
      top: topItemsBySpend(lines, 8),
      cheaper: cheaperRetailer(lines).slice(0, 5),
    };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function SpendPage() {
  const data = await load();

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/" className="text-sm text-brand-600">← Home</a>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">Spending</h1>
      <p className="mb-6 text-sm text-ink/60">From your receipts — no bank link needed.</p>

      {!data.ready && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t reach the database. {data.error?.slice(0, 120)}
        </p>
      )}

      {data.ready && data.empty && (
        <p className="rounded-xl bg-white p-5 text-sm text-ink/60 shadow-sm">
          No spend yet — once receipts land, this fills in.
        </p>
      )}

      {data.ready && !data.empty && (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-brand-500 p-5 text-white shadow-sm">
              <div className="text-xs uppercase tracking-wide text-white/80">This month</div>
              <div className="mt-1 text-2xl font-bold">{fmt(data.thisMonth)}</div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-ink/50">This week</div>
              <div className="mt-1 text-2xl font-bold text-ink">{fmt(data.budget.actualCents)}</div>
              {data.budget.budgetCents != null && (
                <div className={`mt-1 text-xs ${data.budget.overBudget ? "text-red-600" : "text-brand-600"}`}>
                  {data.budget.overBudget ? "over" : "under"} budget by {fmt(Math.abs(data.budget.deltaCents ?? 0))}
                </div>
              )}
            </div>
          </section>

          {data.top.length > 0 && (
            <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-ink">Top items by spend</h2>
              <ul className="mt-3 space-y-1 text-sm text-ink/70">
                {data.top.map((t) => (
                  <li key={t.canonicalItemId} className="flex justify-between">
                    <span>{t.name}</span>
                    <span className="tabular-nums text-ink">{fmt(t.totalCents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.cheaper.length > 0 && (
            <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-ink">Cheaper elsewhere</h2>
              <ul className="mt-3 space-y-1 text-sm text-ink/70">
                {data.cheaper.map((c) => (
                  <li key={c.canonicalItemId}>
                    <span className="text-ink">{c.name}</span> — cheapest at{" "}
                    <span className="font-medium">{retailerLabel(c.bestRetailer)}</span> ({fmt(c.bestCents)}), save{" "}
                    {fmt(c.savingsVsWorstCents)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
