import { getDb, getLatestUserId, loadWrappedInputs } from "@gm/db";
import { buildWrapped, type WrappedStats } from "@gm/core/spend";
import { ShareButton } from "./share-button.js";

export const dynamic = "force-dynamic";

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

async function load() {
  try {
    const db = getDb();
    const userId = await getLatestUserId(db);
    if (!userId) return { ready: false as const, error: null as string | null };
    const input = await loadWrappedInputs(db, userId);
    return { ready: true as const, error: null as string | null, stats: buildWrapped(input) };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

function shareText(s: WrappedStats): string {
  const lines = [
    `My Grocery Wrapped — ${s.periodLabel} 🧺`,
    `🍳 ${s.homeCookedMeals} home-cooked meals`,
    `💸 ~${fmt(s.estSavedCents)} saved vs takeout`,
    s.itemsExpired > 0 ? `🗑️ ${s.itemsExpired} items let expire` : null,
    s.topRecipes[0] ? `⭐ Top: ${s.topRecipes[0].title}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-5 shadow-sm ${
        accent ? "bg-brand-500 text-white" : "border border-black/5 bg-white text-ink"
      }`}
    >
      <div className={`text-3xl font-bold tabular-nums ${accent ? "" : "text-ink"}`}>{value}</div>
      <div className={`mt-1 text-xs uppercase tracking-wide ${accent ? "text-white/80" : "text-ink/50"}`}>
        {label}
      </div>
    </div>
  );
}

export default async function WrappedPage() {
  const data = await load();
  const empty = data.ready && data.stats.homeCookedMeals === 0 && data.stats.totalSpentCents === 0;

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/spend" className="text-sm text-brand-600">← Spending</a>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">Grocery Wrapped</h1>
      <p className="mb-6 text-sm text-ink/60">
        {data.ready ? `Your ${data.stats.periodLabel} in food.` : "Your recent run in food."} Built only from
        your own data.
      </p>

      {!data.ready && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t reach the database. {data.error?.slice(0, 120)}
        </p>
      )}

      {empty && (
        <p className="rounded-xl bg-white p-5 text-sm text-ink/60 shadow-sm">
          Cook a few meals and let some receipts land — your Wrapped fills in here.
        </p>
      )}

      {data.ready && !empty && (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-4">
            <Stat label="Home-cooked meals" value={String(data.stats.homeCookedMeals)} accent />
            <Stat label="Saved vs takeout (est.)" value={`~${fmt(data.stats.estSavedCents)}`} />
            <Stat label="Grocery spend" value={fmt(data.stats.totalSpentCents)} />
            <Stat label="Items let expire" value={String(data.stats.itemsExpired)} />
          </section>

          {data.stats.topRecipes.length > 0 && (
            <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-ink">Your top recipes</h2>
              <ol className="mt-3 space-y-1 text-sm text-ink/70">
                {data.stats.topRecipes.map((r, i) => (
                  <li key={r.title} className="flex justify-between">
                    <span>
                      {i + 1}. {r.title}
                    </span>
                    <span className="tabular-nums text-ink/50">×{r.count}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="flex items-center gap-3">
            <ShareButton text={shareText(data.stats)} />
            <span className="text-xs text-ink/40">Savings are a friendly estimate, not exact.</span>
          </div>
        </div>
      )}
    </main>
  );
}
