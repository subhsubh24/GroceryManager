import { loadEnv } from "@gm/config/env";
import { getDb, withTenant } from "@gm/db";
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
    const digest = await withTenant(getDb(), userId, (tx) => buildDigestForUser(tx, userId));
    return { ready: true as const, error: null as string | null, digest };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e) };
  }
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
