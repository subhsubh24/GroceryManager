export default function InviteLoading() {
  return (
    <main className="page">
      {/* PageHeader placeholder */}
      <div className="h-28 animate-pulse rounded-2xl bg-ink-100" />

      {/* Invite link card */}
      <div className="mt-6 space-y-3">
        <div className="h-4 w-40 animate-pulse rounded bg-ink-100" />
        <div className="h-4 w-64 animate-pulse rounded bg-ink-100" />
        <div className="h-11 animate-pulse rounded-xl bg-ink-100" />
      </div>

      {/* Friends joined card */}
      <div className="mt-4 space-y-2">
        <div className="h-3 w-28 animate-pulse rounded bg-ink-100" />
        <div className="h-9 w-12 animate-pulse rounded bg-ink-100" />
        <div className="h-4 w-56 animate-pulse rounded bg-ink-100" />
      </div>
    </main>
  );
}
