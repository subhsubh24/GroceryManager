export default function HomeLoading() {
  return (
    <main className="relative overflow-hidden">
      <section className="mx-auto max-w-2xl px-5 pb-16 pt-10 sm:px-8 sm:pt-12">
        {/* eyebrow + page-title */}
        <div className="h-3 w-36 animate-pulse rounded bg-ink-100" />
        <div className="mt-3 h-9 w-56 animate-pulse rounded-xl bg-ink-100" />

        {/* panel-brand autopilot section */}
        <div className="mt-6 h-28 animate-pulse rounded-2xl bg-ink-100" />

        {/* pantry card-link */}
        <div className="mt-6 h-24 animate-pulse rounded-2xl bg-ink-100" />

        {/* when-to-buy card-pad */}
        <div className="mt-6 space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-ink-100" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-ink-100" />
          ))}
        </div>

        {/* use-it-up card-pad */}
        <div className="mt-6 space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-ink-100" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-ink-100" />
          ))}
        </div>

        {/* quick-action button row */}
        <div className="mt-6 flex flex-wrap gap-2" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-28 animate-pulse rounded-full bg-ink-100" />
          ))}
        </div>
      </section>
    </main>
  );
}
