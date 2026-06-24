export default function ListLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />

      {/* Add item form */}
      <div className="card-pad mt-6">
        <div className="flex gap-2">
          <div className="h-10 flex-1 animate-pulse rounded-xl bg-ink-100" />
          <div className="h-10 w-20 animate-pulse rounded-xl bg-ink-100" />
        </div>
      </div>

      {/* List rows */}
      <ul className="mt-4 space-y-2.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <li key={i} className="row">
            <div className="h-5 w-5 animate-pulse rounded bg-ink-100" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="h-4 w-40 animate-pulse rounded bg-ink-100" />
              <div className="h-3 w-24 animate-pulse rounded bg-ink-100" />
            </div>
            <div className="h-4 w-4 animate-pulse rounded bg-ink-100" />
          </li>
        ))}
      </ul>
    </main>
  );
}
