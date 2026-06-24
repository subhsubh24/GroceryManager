import { revalidatePath } from "next/cache";
import {
  getDb,
  loadReorderInputs,
  setReorderAutopilot,
  setReorderDosage,
  withTenant,
} from "@gm/db";
import { defaultReorderPolicy, predictReorder } from "@gm/core/reorder";
import { currentUserId } from "@/app/lib/tenant";
import { humanize, titleCase } from "@/app/lib/format";
import { PageHeader } from "@/app/components/page-header";
import { Check, Repeat } from "@/app/components/icons";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

async function toggleAutopilot(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const enabled = formData.get("enabled") === "true";
  const userId = await currentUserId();
  if (!userId) return;

  let seed: ReturnType<typeof defaultReorderPolicy> | undefined;
  if (enabled) {
    const onHand = Number(formData.get("onHand") ?? 0);
    const rateRaw = formData.get("rate");
    const rate = rateRaw == null || rateRaw === "" ? null : Number(rateRaw);
    seed = defaultReorderPolicy({ baseQtyOnHand: onHand, ratePerDay: rate });
  }
  await withTenant(getDb(), userId, (tx) => setReorderAutopilot(tx, userId, id, enabled, seed));
  revalidatePath("/staples");
}

async function setDosage(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const raw = formData.get("dosesPerDay");
  const n = raw == null || raw === "" ? null : Number(raw);
  const dosesPerDay = n != null && Number.isFinite(n) && n > 0 ? n : null;
  const userId = await currentUserId();
  if (!userId) return;
  await withTenant(getDb(), userId, (tx) => setReorderDosage(tx, userId, id, dosesPerDay));
  revalidatePath("/staples");
}

async function load() {
  try {
    const userId = await currentUserId();
    if (!userId) return { ready: false as const, error: null as string | null };
    const rows = await withTenant(getDb(), userId, (tx) => loadReorderInputs(tx, userId));
    const now = new Date();
    const items = rows
      // consumables, already-managed, anything with a declared dose, or supplements (so a fresh
      // supplement shows up to set its dose before any cadence exists).
      .filter((r) => r.ratePerDay != null || r.enabled || r.dosesPerDay != null || r.domain === "supplement")
      .map((r) => {
        const enabled = r.enabled ?? false;
        const pred = predictReorder(
          {
            baseQtyOnHand: r.baseQtyOnHand,
            estimatedConsumptionRatePerDay: r.ratePerDay,
            confidence: r.confidence,
            dosesPerDay: r.dosesPerDay,
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
    <main className="page">
      <PageHeader
        accent="brand"
        icon={Repeat}
        eyebrow="Autopilot"
        title="Staples autopilot"
        subtitle={
          <>
            Turn on the things you always want around. They&apos;ll appear on your list automatically when
            they&apos;re due — set and forget.
          </>
        }
        back={{ href: "/list", label: "Reorder" }}
      />

      {!data.ready && (
        <p className="notice-warn mt-6">
          Couldn&apos;t reach the database.
        </p>
      )}

      {data.ready && data.items.length === 0 && (
        <div className="empty-state mt-6">
          <div className="empty-emoji">
            <Repeat className="h-6 w-6" strokeWidth={2} />
          </div>
          <p className="text-sm font-medium text-ink-700">No staples yet</p>
          <p className="mt-1 max-w-xs text-sm text-ink-400">
            Once the app has learned a buying rhythm for a few items, they&apos;ll show up here to put on
            autopilot.
          </p>
        </div>
      )}

      {recurring.length > 0 && (
        <section className="panel-brand mt-6">
          <h2 className="font-display text-lg font-semibold">Coming up on your list</h2>
          <ul className="mt-2 space-y-1 text-sm text-white/90">
            {recurring.map((i) => (
              <li key={`due-${i.canonicalItemId}`}>
                {titleCase(i.name)}
                {i.pred.recommendQty ? ` · ~${Math.round(i.pred.recommendQty)}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.ready && data.items.length > 0 && (
        <ul className="mt-6 space-y-2">
          {data.items.map((i) => (
            <li key={i.canonicalItemId} className="row items-start">
              <div className="min-w-0">
                <div className="font-medium text-ink-900">{titleCase(i.name)}</div>
                <div className="text-xs text-ink-400">
                  {humanize(i.domain)}
                  {i.dosesPerDay != null
                    ? ` · ${i.dosesPerDay}/day`
                    : i.ratePerDay != null
                      ? ` · ~${(i.ratePerDay * 7).toFixed(1)}/wk`
                      : ""}
                  {i.enabled ? ` · next ~${fmtDate(i.pred.recommendByDate ?? i.pred.predictedRunOutAt)}` : ""}
                </div>
                <form action={setDosage} className="mt-1.5 flex items-center gap-1.5">
                  <input type="hidden" name="id" value={i.canonicalItemId} />
                  <input
                    name="dosesPerDay"
                    type="number"
                    step="0.5"
                    min="0"
                    defaultValue={i.dosesPerDay ?? ""}
                    placeholder="0"
                    aria-label={`Daily dose for ${i.name}`}
                    className="w-16 rounded-lg border border-line bg-surface px-2 py-1 text-xs shadow-xs focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
                  />
                  <span className="text-xs text-ink-400">/day dose</span>
                  <button type="submit" className="btn-ghost btn-sm">
                    Set
                  </button>
                </form>
              </div>
              <form action={toggleAutopilot}>
                <input type="hidden" name="id" value={i.canonicalItemId} />
                <input type="hidden" name="enabled" value={i.enabled ? "false" : "true"} />
                <input type="hidden" name="onHand" value={String(i.baseQtyOnHand)} />
                <input type="hidden" name="rate" value={i.ratePerDay != null ? String(i.ratePerDay) : ""} />
                <button
                  type="submit"
                  className={
                    i.enabled
                      ? "btn-secondary btn-sm inline-flex items-center gap-1 rounded-full"
                      : "btn-dark btn-sm rounded-full"
                  }
                >
                  {i.enabled ? (
                    <>
                      <Check className="h-3.5 w-3.5" strokeWidth={2} /> On autopilot
                    </>
                  ) : (
                    "Turn on"
                  )}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
