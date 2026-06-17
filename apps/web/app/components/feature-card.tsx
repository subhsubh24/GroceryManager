import type { Section } from "@/app/lib/sections";

/**
 * ONE uniform calm card for every feature, shared by the `/tools` index and the logged-out home
 * highlights. Neutral tile + clean Inter title + quiet blurb, with a quiet accent arrow on hover.
 * Presentation-only — no color themes, no per-card glow (the calm/Airbnb visual system).
 */
export function FeatureCard({ s, index = 0 }: { s: Section; index?: number }) {
  const style = { animationDelay: `${Math.min(index * 24, 280)}ms` };
  return (
    <a href={s.href} style={style} className="group bento-card animate-fade-in-up">
      <div className="flex items-start justify-between">
        <div className="tile">{s.emoji}</div>
        <span className="text-ink-300 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          →
        </span>
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-[-0.01em] text-ink-900">{s.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{s.blurb}</p>
    </a>
  );
}
