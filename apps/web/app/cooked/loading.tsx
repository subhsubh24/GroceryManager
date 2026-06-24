export default function CookedLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />

      {/* Date group header */}
      <div className="mt-6 h-4 w-24 animate-pulse rounded bg-ink-100" />

      {/* Meal rows */}
      <ul className="mt-3 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="row">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-ink-100" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-4 w-40 animate-pulse rounded bg-ink-100" />
                <div className="h-3 w-56 animate-pulse rounded bg-ink-100" />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Second date group */}
      <div className="mt-8 h-4 w-24 animate-pulse rounded bg-ink-100" />
      <ul className="mt-3 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="row">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-ink-100" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-4 w-36 animate-pulse rounded bg-ink-100" />
                <div className="h-3 w-48 animate-pulse rounded bg-ink-100" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
