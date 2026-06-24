export default function ManageSubscriptionLoading() {
  return (
    <main className="page-narrow">
      {/* PageHeader placeholder */}
      <div className="h-28 animate-pulse rounded-2xl bg-ink-100" />

      {/* Current plan card */}
      <div className="mt-6 space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-ink-100" />
        <div className="h-7 w-40 animate-pulse rounded-xl bg-ink-100" />
        <div className="h-4 w-72 animate-pulse rounded bg-ink-100" />
        <div className="h-4 w-64 animate-pulse rounded bg-ink-100" />
      </div>

      {/* Pricing row */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />
        <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />
      </div>
    </main>
  );
}
