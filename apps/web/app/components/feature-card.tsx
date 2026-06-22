import type { Section } from "@/app/lib/sections";
import { ChevronRight } from "@/app/components/icons";

/**
 * ONE uniform calm card for every feature, shared by the `/tools` index and the logged-out home
 * highlights. Neutral icon tile + clean title + quiet blurb, with a quiet accent chevron on hover.
 * Presentation-only — no color themes, no per-card glow, no per-index entrance (the calm system).
 */
export function FeatureCard({ s }: { s: Section; index?: number }) {
  return (
    <a href={s.href} className="group bento-card">
      <div className="flex items-start justify-between">
        <div className="tile">
          <s.icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <span className="text-ink-300 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-[-0.01em] text-ink-900">{s.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{s.blurb}</p>
    </a>
  );
}
