import { getAdminDb, getWaitlistSubmissions } from "@gm/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Waitlist — Admin",
};

export default async function WaitlistAdminPage() {
  const data = await getWaitlistSubmissions(getAdminDb());

  return (
    <main>
      <h1 className="page-title">Waitlist</h1>

      {data === null ? (
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
              <p className="text-3xl font-semibold tracking-tight text-brand-solid">{data.total}</p>
              <p className="mt-1 text-sm text-ink-400">Total sign-ups</p>
            </div>
            <div className="card-pad flex-1 text-center">
              <p className="text-3xl font-semibold tracking-tight text-ink-900">
                {
                  data.rows.filter(
                    (r) => new Date(r.created_at) > new Date(Date.now() - 7 * 86400_000),
                  ).length
                }
              </p>
              <p className="mt-1 text-sm text-ink-400">Last 7 days</p>
            </div>
          </div>

          {data.rows.length === 0 ? (
            <p className="mt-8 text-sm text-ink-400">No submissions yet.</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Source</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 pr-4 font-medium text-ink-800">{row.email}</td>
                      <td className="py-2 pr-4 text-ink-400">{row.source}</td>
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
              {data.total > 500 && (
                <p className="mt-3 text-xs text-ink-400">Showing first 500 of {data.total} submissions.</p>
              )}
            </div>
          )}

          <div className="mt-8 card-pad">
            <p className="section-title">Export</p>
            <p className="mt-1 text-sm text-ink-500">
              To export the full list, run this query in your database console:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-50 p-4 text-xs text-ink-700">
              {`COPY (SELECT email, source, created_at FROM waitlist_submissions ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;`}
            </pre>
          </div>
        </>
      )}
    </main>
  );
}
