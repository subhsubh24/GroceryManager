import { getAdminDb, getWaitlistWithUtm } from "@gm/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Waitlist — Admin",
};

function domainOnly(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 40);
  }
}

export default async function WaitlistAdminPage() {
  const rows = await getWaitlistWithUtm(getAdminDb());

  const total = rows?.length ?? 0;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const lastSevenDays = rows?.filter((r) => new Date(r.created_at) >= sevenDaysAgo).length ?? 0;

  // Top 5 UTM sources
  const sourceCounts: Record<string, number> = {};
  for (const r of rows ?? []) {
    const key = r.utm_source ?? "(direct)";
    sourceCounts[key] = (sourceCounts[key] ?? 0) + 1;
  }
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <main>
      <h1 className="page-title">Waitlist</h1>

      {rows === null ? (
        <div className="notice-info mt-6">
          <p className="text-sm font-medium">Migration pending</p>
          <p className="mt-1 text-sm">
            The <code>waitlist_submissions</code> table does not exist yet. Apply migration 0012 (see{" "}
            <code>packages/db/sql/0012_waitlist.sql</code> and <code>PENDING_OPS.md</code>) to start
            persisting waitlist submissions.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex gap-4">
            <div className="card-pad flex-1 text-center">
              <p className="text-3xl font-semibold tracking-tight text-brand-solid">{total}</p>
              <p className="mt-1 text-sm text-ink-400">Total sign-ups</p>
            </div>
            <div className="card-pad flex-1 text-center">
              <p className="text-3xl font-semibold tracking-tight text-ink-900">{lastSevenDays}</p>
              <p className="mt-1 text-sm text-ink-400">Last 7 days</p>
            </div>
          </div>

          {topSources.length > 0 && (
            <div className="mt-6 card-pad">
              <p className="section-title">Top acquisition sources</p>
              <ul className="mt-3 space-y-1">
                {topSources.map(([src, count]) => (
                  <li key={src} className="flex items-center justify-between text-sm">
                    <span className="text-ink-700">{src}</span>
                    <span className="font-medium text-ink-900">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rows.length === 0 ? (
            <p className="mt-8 text-sm text-ink-400">No submissions yet.</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Source</th>
                    <th className="pb-2 pr-4">UTM Source</th>
                    <th className="pb-2 pr-4">UTM Campaign</th>
                    <th className="pb-2 pr-4">Referrer</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 pr-4 font-medium text-ink-800">{row.email}</td>
                      <td className="py-2 pr-4 text-ink-400">{row.source}</td>
                      <td className="py-2 pr-4 text-ink-400">{row.utm_source ?? "—"}</td>
                      <td className="py-2 pr-4 text-ink-400">{row.utm_campaign ?? "—"}</td>
                      <td className="py-2 pr-4 text-ink-400" title={row.referrer_url ?? undefined}>
                        {domainOnly(row.referrer_url) ?? "—"}
                      </td>
                      <td className="py-2 text-ink-400">
                        {new Date(row.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {total > 500 && (
                <p className="mt-3 text-xs text-ink-400">
                  Showing first 500 of {total} submissions.
                </p>
              )}
            </div>
          )}

          <div className="mt-8 card-pad">
            <p className="section-title">Export</p>
            <p className="mt-1 text-sm text-ink-500">
              To export the full list, run this query in your database console:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-50 p-4 text-xs text-ink-700">
              {`COPY (SELECT email, source, utm_source, utm_campaign, referrer_url, created_at FROM waitlist_submissions ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;`}
            </pre>
          </div>
        </>
      )}
    </main>
  );
}
