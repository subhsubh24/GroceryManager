export default function ProfileLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />

      {/* Account info card */}
      <div className="card-pad mt-6 space-y-3">
        <div className="h-4 w-28 animate-pulse rounded bg-ink-100" />
        <div className="h-9 w-full animate-pulse rounded-xl bg-ink-100" />
        <div className="h-4 w-28 animate-pulse rounded bg-ink-100" />
        <div className="h-9 w-full animate-pulse rounded-xl bg-ink-100" />
        <div className="h-9 w-32 animate-pulse rounded-xl bg-ink-100" />
      </div>

      {/* Subscription card */}
      <div className="card-pad mt-4 space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-ink-100" />
        <div className="h-4 w-40 animate-pulse rounded bg-ink-100" />
        <div className="h-9 w-48 animate-pulse rounded-xl bg-ink-100" />
      </div>

      {/* Danger zone card */}
      <div className="card-pad mt-4 space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-ink-100" />
        <div className="h-3 w-64 animate-pulse rounded bg-ink-100" />
      </div>
    </main>
  );
}
