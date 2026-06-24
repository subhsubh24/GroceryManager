/**
 * Instant feedback while /make loads — pantry gate check + LLM meal generation can be slow.
 * Next renders this immediately on navigation so the screen never flashes blank.
 */
export default function MakeLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-28 animate-pulse rounded-2xl bg-surface-1" />

      {/* Energy tabs */}
      <div className="mt-6 mb-3 flex flex-wrap gap-2">
        <div className="h-9 w-40 animate-pulse rounded-full bg-surface-1" />
        <div className="h-9 w-32 animate-pulse rounded-full bg-surface-1" />
        <div className="h-9 w-28 animate-pulse rounded-full bg-surface-1" />
      </div>

      {/* Generating panel */}
      <section className="panel-brand mt-2">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          <p className="font-display text-lg font-semibold">Thinking up ideas…</p>
        </div>
        <p className="mt-1 text-sm text-white/90">
          Matching what&apos;s in your pantry to meals you can make tonight.
        </p>
      </section>

      {/* Meal cards */}
      <ul className="mt-6 space-y-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="card p-4 flex gap-4">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-xl bg-surface-1" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 w-20 animate-pulse rounded bg-surface-1" />
              <div className="h-5 w-3/4 animate-pulse rounded bg-surface-1" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-surface-1" />
              <div className="h-3 w-2/5 animate-pulse rounded bg-surface-1" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
