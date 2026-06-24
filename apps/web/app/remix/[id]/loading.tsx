export default function RemixLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-28 animate-pulse rounded-2xl bg-ink-100" />

      {/* Axis tabs */}
      <div className="mt-6 mb-4 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-ink-100" />
        ))}
      </div>

      {/* LLM thinking panel */}
      <section className="panel-brand">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          <p className="font-display text-lg font-semibold">Remixing…</p>
        </div>
        <p className="mt-1 text-sm text-white/90">
          Finding smart ingredient swaps for this recipe.
        </p>
      </section>

      {/* Swap card shapes */}
      <ul className="mt-4 space-y-3" aria-hidden>
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="h-20 animate-pulse rounded-2xl bg-ink-100" />
        ))}
      </ul>
    </main>
  );
}
