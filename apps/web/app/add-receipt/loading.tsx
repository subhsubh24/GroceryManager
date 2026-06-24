/**
 * Instant feedback while /add-receipt loads — vision LLM extract + ingest can take up to 60s.
 * Next renders this immediately on navigation so the screen never flashes blank.
 */
export default function AddReceiptLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />

      {/* Upload / photo form area */}
      <div className="mt-6 space-y-4">
        {/* Drop zone / file picker area */}
        <div className="h-52 w-full animate-pulse rounded-2xl bg-ink-100" />

        {/* Note / hint text area */}
        <div className="h-4 w-72 animate-pulse rounded bg-ink-100" />
        <div className="h-4 w-56 animate-pulse rounded bg-ink-100" />
      </div>
    </main>
  );
}
