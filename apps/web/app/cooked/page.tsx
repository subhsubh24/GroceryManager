import { getDb, loadCookLog, withTenant, type CookLogEntry } from "@gm/db";
import { currentUserId } from "@/app/lib/tenant";
import { PageHeader } from "@/app/components/page-header";
import { UtensilsCrossed } from "@/app/components/icons";

export const dynamic = "force-dynamic";

const dateFmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** "520 kcal · P 32g · C 45g · F 18g", or "—" when this meal has no stored macros. */
function macroLine(m: Pick<CookLogEntry, "kcal" | "proteinG" | "carbsG" | "fatG">): string {
  if (m.kcal == null && m.proteinG == null && m.carbsG == null && m.fatG == null) return "—";
  const g = (v: number | null) => (v == null ? "–" : `${Math.round(v)}g`);
  return `${m.kcal == null ? "–" : `${Math.round(m.kcal)} kcal`} · P ${g(m.proteinG)} · C ${g(
    m.carbsG,
  )} · F ${g(m.fatG)}`;
}

async function load() {
  try {
    const userId = await currentUserId();
    if (!userId) return { ready: false as const, error: null as string | null };
    const meals = await withTenant(getDb(), userId, (tx) => loadCookLog(tx, userId));
    return { ready: true as const, error: null as string | null, meals };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function CookedPage() {
  const data = await load();

  // Today's running total — sum the (present) macros over meals cooked today.
  const todays = data.ready ? data.meals.filter((m) => isToday(m.cookedAt)) : [];
  const todayTotal = todays.reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.kcal ?? 0),
      proteinG: acc.proteinG + (m.proteinG ?? 0),
      carbsG: acc.carbsG + (m.carbsG ?? 0),
      fatG: acc.fatG + (m.fatG ?? 0),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  return (
    <main className="page">
      <PageHeader
        icon={UtensilsCrossed}
        eyebrow="Cooked"
        title="Meals & macros"
        subtitle="Everything you've cooked — with the calories and macros, tracked over time."
      />

      {!data.ready && (
        <p className="notice-warn mt-6">
          Couldn&apos;t reach the database. {data.error?.slice(0, 120)}
        </p>
      )}

      {data.ready && data.meals.length === 0 && (
        <div className="empty-state mt-6">
          <div className="empty-emoji">
            <UtensilsCrossed className="h-6 w-6" strokeWidth={2} />
          </div>
          <p className="text-sm font-medium text-ink-700">No cooks logged yet</p>
          <p className="mt-1 max-w-xs text-sm text-ink-400">
            Cook a recipe and tap “I cooked this” — it lands here with its macros.
          </p>
          <a href="/recipes" className="btn-secondary btn-sm mt-4 inline-flex">
            Find something to cook →
          </a>
        </div>
      )}

      {data.ready && data.meals.length > 0 && (
        <div className="mt-6 space-y-6">
          {todays.length > 0 && (
            <section className="panel-brand !rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wide text-white/80">
                Today · {todays.length} {todays.length === 1 ? "meal" : "meals"}
              </div>
              <div className="mt-1 font-display text-2xl font-bold">
                {Math.round(todayTotal.kcal)} kcal
              </div>
              <div className="mt-1 text-sm text-white/85 tabular-nums">
                P {Math.round(todayTotal.proteinG)}g · C {Math.round(todayTotal.carbsG)}g · F{" "}
                {Math.round(todayTotal.fatG)}g
              </div>
            </section>
          )}

          <ul className="space-y-3">
            {data.meals.map((m) => (
              <li key={m.id} className="card card-hover p-4 flex gap-4">
                {m.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="tile h-16 w-16 shrink-0">
                    <UtensilsCrossed className="h-6 w-6" strokeWidth={2} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="truncate font-medium text-ink-900">{m.title ?? "Logged meal"}</div>
                    <div className="shrink-0 text-xs text-ink-400">{dateFmt(m.cookedAt)}</div>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-400">
                    {m.servingsMade != null
                      ? `${m.servingsMade} ${m.servingsMade === 1 ? "serving" : "servings"}`
                      : "1 serving"}
                  </div>
                  <div className="mt-1.5 text-sm text-ink-600 tabular-nums">{macroLine(m)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
