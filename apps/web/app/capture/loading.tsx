export default function CaptureLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-28 animate-pulse rounded-2xl bg-ink-100" />

      {/* Input area card */}
      <div className="mt-6 space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />
        <div className="h-11 w-36 animate-pulse rounded-xl bg-ink-100" />
      </div>

      {/* List skeleton */}
      <div className="mt-8 space-y-2" aria-hidden>
        <div className="h-4 w-28 animate-pulse rounded bg-ink-100" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-xl bg-ink-100" />
        ))}
      </div>
    </main>
  );
}
