export default function AskLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-28 animate-pulse rounded-2xl bg-ink-100" />

      {/* Thinking panel */}
      <section className="panel-brand mt-6">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          <p className="font-display text-lg font-semibold">Loading your kitchen…</p>
        </div>
        <p className="mt-1 text-sm text-white/90">
          Pulling in your pantry, habits, and spending data.
        </p>
      </section>

      {/* Chat bubble shapes */}
      <div className="mt-6 space-y-3" aria-hidden>
        <div className="flex justify-end">
          <div className="h-10 w-48 animate-pulse rounded-2xl rounded-br-sm bg-ink-100" />
        </div>
        <div className="flex justify-start">
          <div className="h-16 w-64 animate-pulse rounded-2xl rounded-bl-sm bg-ink-100" />
        </div>
        <div className="flex justify-end">
          <div className="h-10 w-36 animate-pulse rounded-2xl rounded-br-sm bg-ink-100" />
        </div>
        <div className="flex justify-start">
          <div className="h-20 w-72 animate-pulse rounded-2xl rounded-bl-sm bg-ink-100" />
        </div>
      </div>
    </main>
  );
}
