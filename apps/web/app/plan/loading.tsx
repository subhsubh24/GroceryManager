import { PageHeader } from "@/app/components/page-header";
import { CalendarDays } from "@/app/components/icons";

/**
 * Instant feedback while /plan does its work (TheMealDB lookups + the planning LLM can take a while).
 * Next renders this immediately on navigation so "Plan my week" never looks like it did nothing.
 */
export default function PlanLoading() {
  return (
    <main className="page">
      <PageHeader
        accent="grape"
        icon={CalendarDays}
        eyebrow="Your week"
        title="Plan my week"
        subtitle="Five dinners built from what you have, using up what's about to expire first."
      />
      <section className="panel-brand mt-6">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          <p className="font-display text-lg font-semibold">Building your week…</p>
        </div>
        <p className="mt-1 text-sm text-white/90">
          Looking at what you have, what&apos;s expiring, and your taste — one moment.
        </p>
      </section>
      <ul className="mt-6 space-y-3" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="card flex gap-4 p-4">
            <div className="h-16 w-16 shrink-0 animate-pulse rounded-xl bg-ink-100" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 w-20 animate-pulse rounded bg-ink-100" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-ink-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
