export default function ScanLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-28 animate-pulse rounded-2xl bg-ink-100" />

      {/* Camera / upload area */}
      <div className="mt-6 space-y-3">
        <div className="h-56 animate-pulse rounded-2xl bg-ink-100" />
        <div className="flex gap-3">
          <div className="h-11 flex-1 animate-pulse rounded-xl bg-ink-100" />
          <div className="h-11 flex-1 animate-pulse rounded-xl bg-ink-100" />
        </div>
      </div>
    </main>
  );
}
