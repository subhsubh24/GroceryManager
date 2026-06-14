import { getDb, getPantryView, loadReorderInputs, loadWrappedInputs, withTenant } from "@gm/db";
import { selectExpiringSoon } from "@gm/core/pantry";
import { predictReorder } from "@gm/core/reorder";
import { buildDigest } from "@gm/core/digest";
import { currentUserId } from "@/app/lib/tenant";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

async function load() {
  try {
    const userId = await currentUserId();
    if (!userId) return { ready: false as const, error: null as string | null };

    const { pantry, reorder, wrapped } = await withTenant(getDb(), userId, async (tx) => ({
      pantry: await getPantryView(tx, userId),
      reorder: await loadReorderInputs(tx, userId),
      wrapped: await loadWrappedInputs(tx, userId, 7),
    }));

    const now = new Date();
    const expiring = selectExpiringSoon(pantry, { domain: "grocery", withinDays: 5 }).map((e) => ({
      name: e.name,
      reason: e.reason,
      daysLeft: e.daysLeft,
    }));
    const reorderDue = reorder
      .map((r) => ({
        r,
        pred: predictReorder(
          {
            baseQtyOnHand: r.baseQtyOnHand,
            estimatedConsumptionRatePerDay: r.ratePerDay,
            confidence: r.confidence,
          },
          {
            enabled: r.enabled ?? false,
            targetParQty: r.targetParQty,
            reorderPointQty: r.reorderPointQty,
            leadTimeDays: r.leadTimeDays ?? 2,
            minIntervalDays: r.minIntervalDays ?? 7,
          },
          { asOf: now },
        ),
      }))
      .filter((x) => x.pred.shouldReorder)
      .map((x) => ({
        name: x.r.name,
        recommendQty: x.pred.recommendQty,
        recommendByDate: x.pred.recommendByDate,
      }));

    const digest = buildDigest({
      expiring,
      reorderDue,
      spentThisWeekCents: wrapped.purchases.reduce((s, p) => s + (p.totalCents ?? 0), 0),
      homeCookedThisWeek: wrapped.mealLogs.length,
    });
    return { ready: true as const, error: null as string | null, digest };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function DigestPage() {
  const data = await load();

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/" className="text-sm text-brand-600">← Home</a>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">This week</h1>
      <p className="mb-6 text-sm text-ink/60">Your Sunday briefing — what needs you, at a glance.</p>

      {!data.ready && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t reach the database. {data.error?.slice(0, 120)}
        </p>
      )}

      {data.ready && (
        <div className="space-y-6">
          <section className="rounded-2xl bg-brand-500 p-6 text-white shadow-sm">
            <h2 className="text-lg font-semibold">{data.digest.headline}</h2>
            <p className="mt-1 text-sm text-white/90">{data.digest.subline}</p>
          </section>

          {data.digest.topReorder.length > 0 && (
            <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-ink">Reorder soon</h2>
                <a href="/list" className="text-sm font-medium text-brand-600">Review →</a>
              </div>
              <ul className="space-y-1 text-sm text-ink/70">
                {data.digest.topReorder.map((r) => (
                  <li key={`re-${r.name}`} className="flex justify-between">
                    <span>{r.name}</span>
                    <span className="text-ink/50">{fmtDate(r.recommendByDate) ?? ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.digest.topExpiring.length > 0 && (
            <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-ink">Use it up</h2>
                <a href="/use-it-up" className="text-sm font-medium text-brand-600">Recipes →</a>
              </div>
              <ul className="space-y-1 text-sm text-ink/70">
                {data.digest.topExpiring.map((e) => (
                  <li key={`ex-${e.name}`} className="flex justify-between">
                    <span>{e.name}</span>
                    <span className="text-ink/50">
                      {e.reason === "expired_likely"
                        ? "likely expired"
                        : e.daysLeft != null && e.daysLeft <= 0
                          ? "use today"
                          : `${e.daysLeft}d left`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.digest.isQuiet && (
            <p className="rounded-xl bg-white p-5 text-sm text-ink/60 shadow-sm">
              Nothing needs you right now. Enjoy the week. 🌿
            </p>
          )}
        </div>
      )}
    </main>
  );
}
