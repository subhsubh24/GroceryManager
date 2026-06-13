import { revalidatePath } from "next/cache";
import { getDb, getLatestUserId, loadReorderInputs, setReorderAutopilot } from "@gm/db";
import { defaultReorderPolicy, predictReorder } from "@gm/core/reorder";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

async function toggleAutopilot(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const enabled = formData.get("enabled") === "true";
  const db = getDb();
  const userId = await getLatestUserId(db);
  if (!userId) return;

  let seed: ReturnType<typeof defaultReorderPolicy> | undefined;
  if (enabled) {
    const onHand = Number(formData.get("onHand") ?? 0);
    const rateRaw = formData.get("rate");
    const rate = rateRaw == null || rateRaw === "" ? null : Number(rateRaw);
    seed = defaultReorderPolicy({ baseQtyOnHand: onHand, ratePerDay: rate });
  }
  await setReorderAutopilot(db, userId, id, enabled, seed);
  revalidatePath("/staples");
}

async function load() {
  try {
    const db = getDb();
    const userId = await getLatestUserId(db);
    if (!userId) return { ready: false as const, error: null as string | null };
    const rows = await loadReorderInputs(db, userId);
    const now = new Date();
    const items = rows
      .filter((r) => r.ratePerDay != null || r.enabled) // consumables, or already managed
      .map((r) => {
        const enabled = r.enabled ?? false;
        const pred = predictReorder(
          {
            baseQtyOnHand: r.baseQtyOnHand,
            estimatedConsumptionRatePerDay: r.ratePerDay,
            confidence: r.confidence,
          },
          {
            enabled,
            targetParQty: r.targetParQty,
            reorderPointQty: r.reorderPointQty,
            leadTimeDays: r.leadTimeDays ?? 2,
            minIntervalDays: r.minIntervalDays ?? 7,
          },
          { asOf: now },
        );
        return { ...r, enabled, pred };
      })
      .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name));
    return { ready: true as const, error: null as string | null, items };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function StaplesPage() {
  const data = await load();
  const recurring = data.ready ? data.items.filter((i) => i.enabled && i.pred.shouldReorder) : [];

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/list" className="text-sm text-brand-600">← Reorder</a>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">Staples autopilot</h1>
      <p className="mb-6 text-sm text-ink/60">
        Turn on the things you always want around. They&apos;ll appear on your list automatically when
        they&apos;re due — set and forget.
      </p>

      {!data.ready && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t reach the database. {data.error?.slice(0, 120)}
        </p>
      )}

      {data.ready && data.items.length === 0 && (
        <p className="rounded-xl bg-white p-5 text-sm text-ink/60 shadow-sm">
          Once the app has learned a buying rhythm for a few items, they&apos;ll show up here to put on
          autopilot.
        </p>
      )}

      {recurring.length > 0 && (
        <section className="mb-6 rounded-2xl bg-brand-500 p-5 text-white shadow-sm">
          <h2 className="font-semibold">Coming up on your list</h2>
          <ul className="mt-2 space-y-1 text-sm text-white/90">
            {recurring.map((i) => (
              <li key={`due-${i.canonicalItemId}`}>
                {i.name}
                {i.pred.recommendQty ? ` · ~${Math.round(i.pred.recommendQty)}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.ready && data.items.length > 0 && (
        <ul className="space-y-2">
          {data.items.map((i) => (
            <li
              key={i.canonicalItemId}
              className="flex items-center justify-between gap-4 rounded-xl border border-black/5 bg-white px-4 py-3 shadow-sm"
            >
              <div className="min-w-0">
                <div className="font-medium text-ink">{i.name}</div>
                <div className="text-xs text-ink/50">
                  {i.domain}
                  {i.ratePerDay != null ? ` · ~${(i.ratePerDay * 7).toFixed(1)}/wk` : ""}
                  {i.enabled ? ` · next ~${fmtDate(i.pred.recommendByDate ?? i.pred.predictedRunOutAt)}` : ""}
                </div>
              </div>
              <form action={toggleAutopilot}>
                <input type="hidden" name="id" value={i.canonicalItemId} />
                <input type="hidden" name="enabled" value={i.enabled ? "false" : "true"} />
                <input type="hidden" name="onHand" value={String(i.baseQtyOnHand)} />
                <input type="hidden" name="rate" value={i.ratePerDay != null ? String(i.ratePerDay) : ""} />
                <button
                  type="submit"
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                    i.enabled
                      ? "bg-brand-50 text-brand-700 border border-brand-200"
                      : "bg-ink text-white"
                  }`}
                >
                  {i.enabled ? "On autopilot ✓" : "Turn on"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
