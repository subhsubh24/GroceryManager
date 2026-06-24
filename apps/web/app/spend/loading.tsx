/**
 * Instant feedback while /spend loads — aggregation queries over purchases and line items can be
 * slow. Next renders this immediately on navigation so the screen never flashes blank.
 */
export default function SpendLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />

      <div className="mt-6 space-y-6">
        {/* This month / This week stat tiles */}
        <section className="grid grid-cols-2 gap-4">
          <div className="panel-brand !rounded-2xl p-5 space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-white/20" />
            <div className="h-8 w-24 animate-pulse rounded bg-white/20" />
          </div>
          <div className="card-pad space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-ink-100" />
            <div className="h-8 w-24 animate-pulse rounded bg-ink-100" />
            <div className="h-3 w-32 animate-pulse rounded bg-ink-100" />
          </div>
        </section>

        {/* Top items by spend */}
        <section className="card-pad">
          <div className="mb-3 h-4 w-36 animate-pulse rounded bg-ink-100" />
          <ul className="space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="flex justify-between">
                <div className="h-4 w-40 animate-pulse rounded bg-ink-100" />
                <div className="h-4 w-14 animate-pulse rounded bg-ink-100" />
              </li>
            ))}
          </ul>
        </section>

        {/* Cheaper elsewhere */}
        <section className="card-pad">
          <div className="mb-3 h-4 w-32 animate-pulse rounded bg-ink-100" />
          <ul className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-4 w-5/6 animate-pulse rounded bg-ink-100" />
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
