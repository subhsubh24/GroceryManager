export default function WrappedLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />

      {/* Stats panel */}
      <div className="mt-6 animate-pulse rounded-2xl bg-ink-100 p-6">
        <div className="mb-4 h-4 w-32 rounded bg-ink-200" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-8 w-16 rounded bg-ink-200" />
              <div className="h-3 w-24 rounded bg-ink-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Top meals */}
      <div className="card-pad mt-4">
        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-ink-100" />
        <ul className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 animate-pulse rounded-xl bg-ink-100" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-40 animate-pulse rounded bg-ink-100" />
                <div className="h-3 w-20 animate-pulse rounded bg-ink-100" />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Share button placeholder */}
      <div className="mt-4 h-12 animate-pulse rounded-xl bg-ink-100" />
    </main>
  );
}
