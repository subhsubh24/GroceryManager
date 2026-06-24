export default function UpgradeLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-28 animate-pulse rounded-2xl bg-ink-100" />

      {/* Pricing card shapes */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-ink-100" />
        ))}
      </div>

      {/* CTA area */}
      <div className="mt-6 space-y-3">
        <div className="h-11 w-full animate-pulse rounded-xl bg-ink-100" />
        <div className="h-4 w-56 animate-pulse rounded bg-ink-100" />
      </div>
    </main>
  );
}
