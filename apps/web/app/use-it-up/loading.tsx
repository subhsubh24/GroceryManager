import { PageHeader } from "@/app/components/page-header";
import { Recycle } from "@/app/components/icons";

/**
 * Instant feedback while /use-it-up loads (pantry + TheMealDB lookups). Next renders this
 * immediately on navigation so expiring-item rescue never looks like a dead end.
 */
export default function UseItUpLoading() {
  return (
    <main className="page">
      <PageHeader
        accent="berry"
        icon={Recycle}
        eyebrow="Reduce waste"
        title="Use it up"
        subtitle="What's about to go bad — and meals to rescue it before it does."
        back={{ href: "/pantry", label: "Pantry" }}
      />
      <section className="panel-brand mt-6">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          <p className="font-display text-lg font-semibold">Checking what&apos;s expiring…</p>
        </div>
        <p className="mt-1 text-sm text-white/90">
          Finding rescue recipes for what&apos;s about to go bad.
        </p>
      </section>
      <ul className="mt-6 space-y-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className="row">
            <div className="h-4 w-32 animate-pulse rounded bg-ink-100" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-ink-100" />
          </li>
        ))}
      </ul>
    </main>
  );
}
