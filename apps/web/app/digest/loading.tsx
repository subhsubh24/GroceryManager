/**
 * Instant feedback while /digest loads — buildDigestForUser + cooking streak calculations can be
 * slow. Next renders this immediately on navigation so the screen never flashes blank.
 */
export default function DigestLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-24 animate-pulse rounded-2xl bg-surface-1" />

      <div className="mt-6 space-y-6">
        {/* Headline panel */}
        <div className="panel-brand space-y-2">
          <div className="h-6 w-3/4 animate-pulse rounded bg-white/20" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-white/20" />
        </div>

        {/* Cooking card */}
        <section className="card-pad">
          <div className="mb-3 flex items-center justify-between">
            <div className="h-4 w-28 animate-pulse rounded bg-surface-1" />
            <div className="h-4 w-16 animate-pulse rounded bg-surface-1" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-line bg-cream/60 p-3 text-center space-y-1">
                <div className="mx-auto h-7 w-12 animate-pulse rounded bg-surface-1" />
                <div className="mx-auto h-3 w-16 animate-pulse rounded bg-surface-1" />
              </div>
            ))}
          </div>
          {/* Weekly activity bars */}
          <div className="mt-4 flex items-end justify-between gap-1.5" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-16 w-full items-end">
                  <div
                    className="w-full animate-pulse rounded-md bg-surface-1"
                    style={{ height: `${20 + (i % 3) * 20}%` }}
                  />
                </div>
                <div className="h-2 w-6 animate-pulse rounded bg-surface-1" />
              </div>
            ))}
          </div>
        </section>

        {/* Reorder soon */}
        <section className="card-pad">
          <div className="mb-3 flex items-center justify-between">
            <div className="h-4 w-24 animate-pulse rounded bg-surface-1" />
            <div className="h-4 w-16 animate-pulse rounded bg-surface-1" />
          </div>
          <ul className="space-y-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex justify-between">
                <div className="h-4 w-32 animate-pulse rounded bg-surface-1" />
                <div className="h-4 w-20 animate-pulse rounded bg-surface-1" />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
