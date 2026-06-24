export default function HomeLoading() {
  return (
    <main className="page">
      {/* Header greeting */}
      <div className="h-8 w-48 animate-pulse rounded-xl bg-ink-100" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-ink-100" />

      {/* Streak / stat tiles */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-ink-100" />
        ))}
      </div>

      {/* Digest / reorder section */}
      <div className="mt-6 space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-ink-100" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100" />
        ))}
      </div>

      {/* Quick-action row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-100" />
        ))}
      </div>
    </main>
  );
}
