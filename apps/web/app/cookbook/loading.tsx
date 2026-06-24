/**
 * Instant feedback while /cookbook loads — loadSavedRecipes + dedupeSaved can take a moment.
 * Next renders this immediately on navigation so the screen never flashes blank.
 */
export default function CookbookLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />

      {/* Recipe grid */}
      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="card p-4 flex gap-4">
            <div className="h-16 w-16 shrink-0 animate-pulse rounded-xl bg-ink-100" />
            <div className="flex min-w-0 flex-1 flex-col space-y-2 py-1">
              <div className="h-4 w-3/4 animate-pulse rounded bg-ink-100" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100" />
              <div className="mt-auto flex items-center justify-between">
                <div className="h-3 w-20 animate-pulse rounded bg-ink-100" />
                <div className="h-6 w-6 animate-pulse rounded-full bg-ink-100" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
