/**
 * Instant feedback while /staples loads — loadReorderInputs + predictReorder calculations can be
 * slow. Next renders this immediately on navigation so the screen never flashes blank.
 */
export default function StaplesLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-28 animate-pulse rounded-2xl bg-surface-1" />

      {/* Coming up panel */}
      <div className="panel-brand mt-6 space-y-2">
        <div className="h-5 w-44 animate-pulse rounded bg-white/20" />
        <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
      </div>

      {/* Staple rows */}
      <ul className="mt-6 space-y-2" aria-hidden>
        {Array.from({ length: 7 }).map((_, i) => (
          <li key={i} className="row items-start">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-4 w-36 animate-pulse rounded bg-surface-1" />
              <div className="h-3 w-48 animate-pulse rounded bg-surface-1" />
              {/* Dose input placeholder */}
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className="h-7 w-16 animate-pulse rounded-lg bg-surface-1" />
                <div className="h-3 w-16 animate-pulse rounded bg-surface-1" />
                <div className="h-7 w-10 animate-pulse rounded-lg bg-surface-1" />
              </div>
            </div>
            <div className="h-8 w-28 animate-pulse rounded-full bg-surface-1" />
          </li>
        ))}
      </ul>
    </main>
  );
}
