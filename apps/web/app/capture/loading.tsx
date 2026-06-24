/**
 * Instant feedback while /capture loads — DB query for the active shopping list can take a moment.
 * Next renders this immediately on navigation so the screen never flashes blank.
 */
export default function CaptureLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />

      {/* Quick-add form: textarea + submit button */}
      <div className="mt-6 mb-8 space-y-3">
        <div className="h-20 w-full animate-pulse rounded-xl bg-ink-100" />
        <div className="h-10 w-28 animate-pulse rounded-xl bg-ink-100" />
      </div>

      {/* "On your list" section title */}
      <div className="mb-3 h-4 w-24 animate-pulse rounded bg-ink-100" />

      {/* List rows */}
      <ul className="space-y-2" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="row">
            <div className="h-4 w-40 animate-pulse rounded bg-ink-100" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-ink-100" />
          </li>
        ))}
      </ul>
    </main>
  );
}
