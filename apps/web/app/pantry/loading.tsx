/**
 * Instant feedback while /pantry loads — getPantryView + Gmail credential + review queue can take
 * a few seconds on first load. Next renders this immediately so the screen never flashes blank.
 */
export default function PantryLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />

      {/* Gmail connect card */}
      <div className="card-pad mt-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-ink-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-ink-100" />
            <div className="h-3 w-64 animate-pulse rounded bg-ink-100" />
          </div>
          <div className="h-9 w-28 animate-pulse rounded-xl bg-ink-100" />
        </div>
      </div>

      {/* Manual add form */}
      <div className="card-pad mt-4">
        <div className="flex gap-2">
          <div className="h-10 flex-1 animate-pulse rounded-xl bg-ink-100" />
          <div className="h-10 w-20 animate-pulse rounded-xl bg-ink-100" />
          <div className="h-10 w-16 animate-pulse rounded-xl bg-ink-100" />
        </div>
      </div>

      {/* Pantry rows */}
      <ul className="mt-6 space-y-2.5" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="row">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-4 w-36 animate-pulse rounded bg-ink-100" />
              <div className="h-3 w-56 animate-pulse rounded bg-ink-100" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-16 animate-pulse rounded-full bg-ink-100" />
              <div className="h-4 w-4 animate-pulse rounded bg-ink-100" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
