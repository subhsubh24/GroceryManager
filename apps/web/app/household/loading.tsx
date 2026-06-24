export default function HouseholdLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />

      {/* Members section */}
      <div className="card-pad mt-6">
        <div className="mb-3 h-4 w-32 animate-pulse rounded bg-ink-100" />
        <ul className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="h-9 w-9 animate-pulse rounded-full bg-ink-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-32 animate-pulse rounded bg-ink-100" />
                <div className="h-3 w-24 animate-pulse rounded bg-ink-100" />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Shared list section */}
      <div className="card-pad mt-4">
        <div className="mb-3 h-4 w-28 animate-pulse rounded bg-ink-100" />
        <ul className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="row">
              <div className="h-5 w-5 animate-pulse rounded bg-ink-100" />
              <div className="h-4 w-36 animate-pulse flex-1 rounded bg-ink-100" />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
