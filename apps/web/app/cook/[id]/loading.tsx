export default function CookLoading() {
  return (
    <main className="page">
      {/* Back-button row */}
      <div className="h-5 w-24 animate-pulse rounded bg-ink-100" />

      {/* Title block */}
      <div className="mt-4 space-y-2">
        <div className="h-4 w-20 animate-pulse rounded bg-ink-100" />
        <div className="h-8 w-3/4 animate-pulse rounded-xl bg-ink-100" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-ink-100" />
      </div>

      {/* Ingredient list */}
      <div className="mt-6 space-y-2" aria-hidden>
        <div className="h-4 w-28 animate-pulse rounded bg-ink-100" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 animate-pulse rounded-xl bg-ink-100" />
        ))}
      </div>

      {/* Step list */}
      <div className="mt-6 space-y-3" aria-hidden>
        <div className="h-4 w-20 animate-pulse rounded bg-ink-100" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-ink-100" />
        ))}
      </div>
    </main>
  );
}
