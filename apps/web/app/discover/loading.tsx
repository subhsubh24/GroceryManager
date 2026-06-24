import { PageHeader } from "@/app/components/page-header";
import { Flame } from "@/app/components/icons";

/**
 * Instant feedback while /discover loads its deck (TheMealDB searches + pantry lookup can take a
 * few seconds). Next renders this immediately on navigation so the page never looks broken.
 */
export default function DiscoverLoading() {
  return (
    <main className="page">
      <PageHeader
        accent="berry"
        icon={Flame}
        eyebrow="Discover"
        title="For you"
        subtitle="Like what looks good — skip what doesn't. It learns your taste as you go."
      />
      <section className="panel-brand mt-8">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          <p className="font-display text-lg font-semibold">Finding ideas for you…</p>
        </div>
        <p className="mt-1 text-sm text-white/90">
          Matching what&apos;s in your pantry to recipes you haven&apos;t seen yet.
        </p>
      </section>
      <ul className="mt-6 space-y-4" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="card flex gap-4 p-4">
            <div className="h-24 w-24 shrink-0 animate-pulse rounded-xl bg-ink-100" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 w-16 animate-pulse rounded bg-ink-100" />
              <div className="h-5 w-3/4 animate-pulse rounded bg-ink-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
