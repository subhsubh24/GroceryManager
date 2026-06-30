import { getDb, loadPreferenceSignals, loadWrappedInputs, withTenant } from "@gm/db";
import { buildWrapped, type WrappedStats } from "@gm/core/spend";
import { canUse, isPremium } from "@gm/core/billing";
import { redirect } from "next/navigation";
import { ShareButton } from "./share-button.js";
import { currentUserId } from "@/app/lib/tenant";
import { PageHeader } from "@/app/components/page-header";
import { PartyPopper } from "@/app/components/icons";

export const dynamic = "force-dynamic";

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

async function load() {
  try {
    const userId = await currentUserId();
    if (!userId) return { ready: false as const, error: null as string | null };
    const [input, signals] = await withTenant(getDb(), userId, (tx) =>
      Promise.all([loadWrappedInputs(tx, userId), loadPreferenceSignals(tx, userId)]),
    );
    const billingOn = process.env.FEATURE_BILLING === "1";
    if (!canUse("wrapped_plus", isPremium(signals), billingOn)) {
      return { ready: false as const, error: null as string | null, upgradeRequired: true as const };
    }
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
    <div className={accent ? "panel-brand !rounded-2xl p-5" : "card-pad"}>
      <div className="font-display text-3xl font-bold tabular-nums">{value}</div>
      <div className={`mt-1 text-xs uppercase tracking-wide ${accent ? "text-white/80" : "text-ink-400"}`}>
        {label}
      </div>
    </div>
  );
}

export default async function WrappedPage() {
  const data = await load();
  if ("upgradeRequired" in data && data.upgradeRequired) redirect("/upgrade?feature=wrapped_plus");
  const empty = data.ready && data.stats.homeCookedMeals === 0 && data.stats.totalSpentCents === 0;

  return (
    <main className="page">
      <PageHeader
        accent="sunset"
        icon={PartyPopper}
        eyebrow="Your year in food"
        title="Grocery Wrapped"
        subtitle={
          <>
            {data.ready ? `Your ${data.stats.periodLabel} in food.` : "Your recent run in food."} Built only from
            your own data.
          </>
        }
        back={{ href: "/spend", label: "Spending" }}
      />

      {!data.ready && (
        <p className="notice-warn mt-6">
          Couldn&apos;t reach the database.
        </p>
      )}

      {empty && (
        <div className="empty-state mt-6">
          <div className="empty-emoji">
            <PartyPopper className="h-6 w-6" strokeWidth={2} />
          </div>
          <p className="text-sm font-medium text-ink-700">Your Wrapped is on its way</p>
          <p className="mt-1 max-w-xs text-sm text-ink-400">
            Cook a few meals and let some receipts land — your Wrapped fills in here.
          </p>
        </div>
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
            <section className="card-pad">
              <h2 className="section-title">Your top recipes</h2>
              <ol className="mt-3 space-y-1 text-sm text-ink-600">
                {data.stats.topRecipes.map((r, i) => (
                  <li key={r.title} className="flex justify-between">
                    <span>
                      {i + 1}. {r.title}
                    </span>
                    <span className="tabular-nums text-ink-400">×{r.count}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="flex items-center gap-3">
            <ShareButton text={shareText(data.stats)} />
            <span className="text-xs text-ink-400">Savings are a friendly estimate, not exact.</span>
          </div>
        </div>
      )}
    </main>
  );
}
