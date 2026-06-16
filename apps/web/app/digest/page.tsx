import { loadEnv } from "@gm/config/env";
import { getDb, loadCookedAt, withTenant } from "@gm/db";
import { cooksThisWeek, currentStreak, longestStreak, weeklyActivity } from "@gm/core/recipe";
import { currentUserId } from "@/app/lib/tenant";
import { buildDigestForUser } from "@/app/lib/digest";
import { PushToggle } from "./push-toggle";
import { PageHeader } from "@/app/components/page-header";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

async function load() {
  try {
    const userId = await currentUserId();
    if (!userId) return { ready: false as const, error: null as string | null };
    const now = new Date();
    const [digest, cookedAt] = await withTenant(getDb(), userId, async (tx) => {
      const d = await buildDigestForUser(tx, userId);
      const c = await loadCookedAt(tx, userId);
      return [d, c] as const;
    });
    const cooking = {
      currentStreak: currentStreak(cookedAt, now),
      longestStreak: longestStreak(cookedAt),
      cooksThisWeek: cooksThisWeek(cookedAt, now),
      weekly: weeklyActivity(cookedAt, now, 8),
      hasCooks: cookedAt.length > 0,
    };
    return { ready: true as const, error: null as string | null, digest, cooking };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

type Cooking = NonNullable<Awaited<ReturnType<typeof load>>["cooking"]>;

function CookingCard({ cooking }: { cooking: Cooking }) {
  const { currentStreak: streak, longestStreak: longest, cooksThisWeek: thisWeek, weekly } = cooking;
  // Normalize bar heights to the busiest week so the strip is always legible (min 8% so a week
  // with ≥1 cook still shows a sliver; empty weeks render as a faint baseline).
  const peak = Math.max(1, ...weekly.map((w) => w.count));

  return (
    <section className="card-pad">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-title">Your cooking</h2>
        <a href="/recipes" className="nav-link">Cook →</a>
      </div>

      {cooking.hasCooks ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-line bg-cream/60 px-3 py-3 text-center">
              <div className="font-display text-2xl font-semibold text-brand-700">🔥 {streak}</div>
              <div className="mt-0.5 text-xs text-ink-400">day streak</div>
            </div>
            <div className="rounded-xl border border-line bg-cream/60 px-3 py-3 text-center">
              <div className="font-display text-2xl font-semibold text-ink-900">{thisWeek}</div>
              <div className="mt-0.5 text-xs text-ink-400">cooks this week</div>
            </div>
            <div className="rounded-xl border border-line bg-cream/60 px-3 py-3 text-center">
              <div className="font-display text-2xl font-semibold text-ink-900">{longest}</div>
              <div className="mt-0.5 text-xs text-ink-400">longest streak</div>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-1.5" aria-hidden>
            {weekly.map((w) => (
              <div key={w.weekStart} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-16 w-full items-end">
                  <div
                    className="w-full rounded-md bg-brand-gradient"
                    style={{ height: `${w.count > 0 ? Math.max(8, (w.count / peak) * 100) : 4}%` }}
                  />
                </div>
                <div className="text-[10px] tabular-nums text-ink-300">{w.weekStart.slice(5)}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-ink-400">Cooks per week · last 8 weeks</p>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-emoji">🍳</div>
          <p className="text-sm font-medium text-ink-700">Cook a recipe to start your streak</p>
          <p className="mt-1 max-w-xs text-sm text-ink-400">
            Log a cook and your streak, weekly count, and activity show up here.
          </p>
        </div>
      )}
    </section>
  );
}

export default async function DigestPage() {
  const data = await load();

  return (
    <main className="page">
      <PageHeader
        accent="grape"
        emoji="🗒️"
        eyebrow="This week"
        title="This week"
        subtitle="Your Sunday briefing — what needs you, at a glance."
      />

      {!data.ready && (
        <p className="notice-warn mt-6">
          Couldn&apos;t reach the database. {data.error?.slice(0, 120)}
        </p>
      )}

      {data.ready && (
        <div className="space-y-6">
          <section className="panel-brand">
            <h2 className="font-display text-xl font-semibold">{data.digest.headline}</h2>
            <p className="mt-1 text-sm text-white/90">{data.digest.subline}</p>
          </section>

          <CookingCard cooking={data.cooking} />

          {data.digest.topReorder.length > 0 && (
            <section className="card-pad">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="section-title">Reorder soon</h2>
                <a href="/list" className="nav-link">Review →</a>
              </div>
              <ul className="space-y-1 text-sm text-ink-600">
                {data.digest.topReorder.map((r) => (
                  <li key={`re-${r.name}`} className="flex justify-between">
                    <span>{r.name}</span>
                    <span className="text-ink-400">{fmtDate(r.recommendByDate) ?? ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.digest.topExpiring.length > 0 && (
            <section className="card-pad">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="section-title">Use it up</h2>
                <a href="/use-it-up" className="nav-link">Recipes →</a>
              </div>
              <ul className="space-y-1 text-sm text-ink-600">
                {data.digest.topExpiring.map((e) => (
                  <li key={`ex-${e.name}`} className="flex justify-between">
                    <span>{e.name}</span>
                    <span className="text-ink-400">
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
            <div className="empty-state mt-6">
              <div className="empty-emoji">🌿</div>
              <p className="text-sm font-medium text-ink-700">Nothing needs you right now</p>
              <p className="mt-1 max-w-xs text-sm text-ink-400">Enjoy the week.</p>
            </div>
          )}

          <PushToggle vapidPublicKey={loadEnv().VAPID_PUBLIC_KEY ?? null} />
        </div>
      )}
    </main>
  );
}
