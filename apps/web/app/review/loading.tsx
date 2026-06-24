/**
 * Instant feedback while /review loads — getReviewQueue can take a moment when the inbox is large.
 * Next renders this immediately on navigation so the screen never flashes blank.
 */
export default function ReviewLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-28 animate-pulse rounded-2xl bg-ink-100" />

      {/* Review inbox list */}
      <div className="mt-6 space-y-3" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-center gap-4">
            {/* Checkbox placeholder */}
            <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-ink-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 animate-pulse rounded bg-ink-100" />
              <div className="h-3 w-36 animate-pulse rounded bg-ink-100" />
            </div>
            {/* Confidence badge */}
            <div className="h-5 w-12 animate-pulse rounded-full bg-ink-100" />
          </div>
        ))}
      </div>

      {/* Confirm button area */}
      <div className="mt-4 h-10 w-36 animate-pulse rounded-xl bg-ink-100" />
    </main>
  );
}
