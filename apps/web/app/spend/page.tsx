import {
  getDb,
  getUserBudgetCents,
  loadLineItemsForSpend,
  loadPurchasesForSpend,
  withTenant,
} from "@gm/db";
import { budgetVsActual, cheaperRetailer, spendByPeriod, topItemsBySpend } from "@gm/core/spend";
import { currentUserId } from "@/app/lib/tenant";
import { PageHeader } from "@/app/components/page-header";
import { Wallet } from "@/app/components/icons";

export const dynamic = "force-dynamic";

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const retailerLabel = (r: string) => r.replace(/_/g, " ");

async function load() {
  try {
    const userId = await currentUserId();
    if (!userId) return { ready: false as const, error: null as string | null };
    const [purchases, lines, budgetCents] = await withTenant(getDb(), userId, (tx) =>
      Promise.all([
        loadPurchasesForSpend(tx, userId),
        loadLineItemsForSpend(tx, userId),
        getUserBudgetCents(tx, userId),
      ]),
    );
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
    <main className="page">
      <PageHeader
        accent="ocean"
        icon={Wallet}
        eyebrow="Spending"
        title="Spending"
        subtitle="From your receipts — no bank link needed."
      >
        <a href="/wrapped" className="btn-secondary btn-sm inline-flex">
          See your Grocery Wrapped →
        </a>
      </PageHeader>

      {!data.ready && (
        <p className="notice-warn mt-6">
          Couldn&apos;t reach the database. {data.error?.slice(0, 120)}
        </p>
      )}

      {data.ready && data.empty && (
        <div className="empty-state mt-6">
          <div className="empty-emoji">
            <Wallet className="h-6 w-6" strokeWidth={2} />
          </div>
          <p className="text-sm font-medium text-ink-700">No spend yet</p>
          <p className="mt-1 max-w-xs text-sm text-ink-400">Once receipts land, this fills in.</p>
        </div>
      )}

      {data.ready && !data.empty && (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-4">
            <div className="panel-brand !rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wide text-white/80">This month</div>
              <div className="mt-1 font-display text-2xl font-bold">{fmt(data.thisMonth)}</div>
            </div>
            <div className="card-pad">
              <div className="text-xs uppercase tracking-wide text-ink-400">This week</div>
              <div className="mt-1 text-2xl font-bold text-ink-900">{fmt(data.budget.actualCents)}</div>
              {data.budget.budgetCents != null && (
                <div className={`mt-1 text-xs ${data.budget.overBudget ? "text-danger" : "text-success"}`}>
                  {data.budget.overBudget ? "over" : "under"} budget by {fmt(Math.abs(data.budget.deltaCents ?? 0))}
                </div>
              )}
            </div>
          </section>

          {data.top.length > 0 && (
            <section className="card-pad">
              <h2 className="section-title">Top items by spend</h2>
              <ul className="mt-3 space-y-1 text-sm text-ink-600">
                {data.top.map((t) => (
                  <li key={t.canonicalItemId} className="flex justify-between">
                    <span>{t.name}</span>
                    <span className="tabular-nums text-ink-900">{fmt(t.totalCents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.cheaper.length > 0 && (
            <section className="card-pad">
              <h2 className="section-title">Cheaper elsewhere</h2>
              <ul className="mt-3 space-y-1 text-sm text-ink-600">
                {data.cheaper.map((c) => (
                  <li key={c.canonicalItemId}>
                    <span className="text-ink-900">{c.name}</span> — cheapest at{" "}
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
