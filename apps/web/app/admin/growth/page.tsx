import { getAdminDb, getWaitlistWithUtm, getContentSchedule } from "@gm/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Growth — Admin",
};

export default async function GrowthAdminPage() {
  const [rows, content] = await Promise.all([
    getWaitlistWithUtm(getAdminDb()),
    getContentSchedule(getAdminDb()),
  ]);

  // Waitlist aggregates
  const totalWaitlist = rows?.length ?? 0;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const lastSevenDays =
    rows?.filter((r) => new Date(r.created_at) >= sevenDaysAgo).length ?? 0;

  // Top 5 UTM sources
  const sourceCounts: Record<string, number> = {};
  for (const r of rows ?? []) {
    const key = r.utm_source ?? "(direct)";
    sourceCounts[key] = (sourceCounts[key] ?? 0) + 1;
  }
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Content aggregates
  const totalContent = content?.length ?? 0;
  const scheduledCount = content?.filter((i) => i.status === "scheduled").length ?? 0;
  const publishedCount = content?.filter((i) => i.status === "published").length ?? 0;

  // Group content by channel: next scheduled item per channel
  const channelMap: Record<string, { nextScheduled: Date | null; publishedCount: number }> = {};
  for (const item of content ?? []) {
    if (!channelMap[item.channel]) {
      channelMap[item.channel] = { nextScheduled: null, publishedCount: 0 };
    }
    if (item.status === "published") {
      channelMap[item.channel].publishedCount += 1;
    }
    if (item.status === "scheduled") {
      const d = new Date(item.scheduled_at);
      if (
        channelMap[item.channel].nextScheduled === null ||
        d < channelMap[item.channel].nextScheduled!
      ) {
        channelMap[item.channel].nextScheduled = d;
      }
    }
  }
  const channels = Object.entries(channelMap);

  return (
    <main>
      <h1 className="page-title">Growth</h1>

      {/* Waitlist funnel */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <p className="section-title">Waitlist funnel</p>
          <a href="/admin/waitlist" className="text-sm text-brand-solid-hover hover:underline">
            View all →
          </a>
        </div>

        {rows === null ? (
          <div className="notice-info mt-4">
            <p className="text-sm">Migration pending — waitlist table not yet created.</p>
          </div>
        ) : (
          <div className="mt-4 flex gap-4">
            <div className="card-pad flex-1 text-center">
              <p className="text-3xl font-semibold tracking-tight text-brand-solid">
                {totalWaitlist}
              </p>
              <p className="mt-1 text-sm text-ink-400">Total sign-ups</p>
            </div>
            <div className="card-pad flex-1 text-center">
              <p className="text-3xl font-semibold tracking-tight text-ink-900">
                {lastSevenDays}
              </p>
              <p className="mt-1 text-sm text-ink-400">Last 7 days</p>
            </div>
          </div>
        )}
      </section>

      {/* Top acquisition sources */}
      {rows !== null && (
        <section className="mt-8">
          <p className="section-title">Top acquisition sources</p>
          {topSources.length === 0 ? (
            <p className="mt-3 text-sm text-ink-400">No UTM data yet.</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {topSources.map(([src, count]) => (
                <li key={src} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{src}</span>
                  <span className="font-medium text-ink-900">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Content pipeline */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <p className="section-title">Content pipeline</p>
          <a href="/admin/content" className="text-sm text-brand-solid-hover hover:underline">
            View all →
          </a>
        </div>

        {content === null ? (
          <div className="notice-info mt-4">
            <p className="text-sm">Migration pending — content_schedule table not yet created.</p>
          </div>
        ) : totalContent === 0 ? (
          <p className="mt-4 text-sm text-ink-400">No content items yet.</p>
        ) : (
          <>
            <div className="mt-4 flex gap-4">
              <div className="card-pad flex-1 text-center">
                <p className="text-2xl font-semibold tracking-tight text-ink-900">
                  {totalContent}
                </p>
                <p className="mt-1 text-sm text-ink-400">Total</p>
              </div>
              <div className="card-pad flex-1 text-center">
                <p className="text-2xl font-semibold tracking-tight text-amber-600">
                  {scheduledCount}
                </p>
                <p className="mt-1 text-sm text-ink-400">Scheduled</p>
              </div>
              <div className="card-pad flex-1 text-center">
                <p className="text-2xl font-semibold tracking-tight text-green-600">
                  {publishedCount}
                </p>
                <p className="mt-1 text-sm text-ink-400">Published</p>
              </div>
            </div>

            {channels.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                      <th className="pb-2 pr-4">Channel</th>
                      <th className="pb-2 pr-4">Next scheduled</th>
                      <th className="pb-2">Published</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {channels.map(([channel, stats]) => (
                      <tr key={channel}>
                        <td className="py-2 pr-4 font-medium text-ink-800">{channel}</td>
                        <td className="py-2 pr-4 text-ink-400">
                          {stats.nextScheduled
                            ? new Date(stats.nextScheduled).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="py-2 text-ink-400">{stats.publishedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
