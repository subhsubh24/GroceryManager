import { getAdminDb, getContentSchedule } from "@gm/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Content Schedule — Admin",
};

const STATUS_CLASSES: Record<string, string> = {
  scheduled: "bg-amber-100 text-amber-800",
  published: "bg-green-100 text-green-800",
  skipped: "bg-slate-100 text-slate-600",
  draft: "bg-gray-100 text-gray-600",
};

function statusBadge(status: string) {
  const cls = STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>
  );
}

export default async function ContentAdminPage() {
  const items = await getContentSchedule(getAdminDb());

  const total = items?.length ?? 0;
  const scheduledCount = items?.filter((i) => i.status === "scheduled").length ?? 0;
  const publishedCount = items?.filter((i) => i.status === "published").length ?? 0;

  return (
    <main>
      <h1 className="page-title">Content Schedule</h1>

      {items === null ? (
        <div className="notice-info mt-6">
          <p className="text-sm font-medium">Migration pending</p>
          <p className="mt-1 text-sm">
            The <code>content_schedule</code> table does not exist yet. Apply migration 0014 to
            start managing scheduled content.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex gap-4">
            <div className="card-pad flex-1 text-center">
              <p className="text-3xl font-semibold tracking-tight text-brand-solid">{total}</p>
              <p className="mt-1 text-sm text-ink-400">Total items</p>
            </div>
            <div className="card-pad flex-1 text-center">
              <p className="text-3xl font-semibold tracking-tight text-amber-600">
                {scheduledCount}
              </p>
              <p className="mt-1 text-sm text-ink-400">Scheduled</p>
            </div>
            <div className="card-pad flex-1 text-center">
              <p className="text-3xl font-semibold tracking-tight text-green-600">
                {publishedCount}
              </p>
              <p className="mt-1 text-sm text-ink-400">Published</p>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="mt-8 text-sm text-ink-400">No content items yet.</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                    <th className="pb-2 pr-4">Channel</th>
                    <th className="pb-2 pr-4">Title</th>
                    <th className="pb-2 pr-4">Content</th>
                    <th className="pb-2 pr-4">Scheduled</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 pr-4 font-medium text-ink-800">{item.channel}</td>
                      <td className="py-2 pr-4 text-ink-700">{item.title}</td>
                      <td
                        className="py-2 pr-4 text-ink-400"
                        title={item.content}
                      >
                        {item.content.length > 80
                          ? item.content.slice(0, 80) + "…"
                          : item.content}
                      </td>
                      <td className="py-2 pr-4 text-ink-400">
                        {new Date(item.scheduled_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2 pr-4">{statusBadge(item.status)}</td>
                      <td className="py-2 text-xs text-red-500">{item.error_msg ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
