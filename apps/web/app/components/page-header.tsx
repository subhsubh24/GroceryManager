import type { ReactNode } from "react";

/**
 * Shared, accent-themed page header — gives every interior screen the same identity language as the
 * landing bento: a gradient emoji badge, an accent-tinted eyebrow, a soft accent glow, and the
 * display-serif title. Pick `accent` to match the section's bento color so the app feels cohesive.
 *
 * Presentation-only. `topRight` holds a secondary link/action on the back-link row; `children`
 * render directly under the subtitle (e.g. a CTA button or filter tabs).
 */
export type Accent = "brand" | "berry" | "grape" | "ocean" | "citrus" | "sunset";

// Full, literal class strings per accent so Tailwind's JIT picks them up (no interpolated fragments).
const ACCENT: Record<Accent, { badge: string; eyebrow: string; glow: string }> = {
  brand: { badge: "bg-brand-gradient shadow-brand", eyebrow: "text-brand-600", glow: "bg-brand-400/25" },
  berry: { badge: "bg-berry-gradient shadow-berry", eyebrow: "text-berry-600 dark:text-berry-400", glow: "bg-berry-400/25" },
  grape: { badge: "bg-grape-gradient shadow-grape", eyebrow: "text-grape-600 dark:text-grape-400", glow: "bg-grape-400/25" },
  ocean: { badge: "bg-ocean-gradient shadow-ocean", eyebrow: "text-ocean-600 dark:text-ocean-400", glow: "bg-ocean-400/25" },
  citrus: { badge: "bg-citrus-gradient shadow-citrus", eyebrow: "text-citrus-700 dark:text-citrus-300", glow: "bg-citrus-300/30" },
  sunset: { badge: "bg-sunset-gradient shadow-citrus", eyebrow: "text-berry-600 dark:text-berry-400", glow: "bg-berry-300/25" },
};

export function PageHeader({
  accent = "brand",
  emoji,
  eyebrow,
  title,
  subtitle,
  back = { href: "/", label: "Home" },
  topRight,
  children,
}: {
  accent?: Accent;
  emoji: string;
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string } | null;
  topRight?: ReactNode;
  children?: ReactNode;
}) {
  const a = ACCENT[accent];
  return (
    <header className="relative">
      {/* Soft, center-anchored accent glow (width-bounded — never causes horizontal scroll). */}
      <div
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-0 -z-10 h-44 w-72 -translate-x-1/2 -translate-y-12 rounded-[100%] blur-3xl ${a.glow}`}
      />
      {(back || topRight) && (
        <div className="flex items-center justify-between gap-3">
          {back ? (
            <a href={back.href} className="back-link">
              <span aria-hidden>←</span> {back.label}
            </a>
          ) : (
            <span />
          )}
          {topRight}
        </div>
      )}
      <div className="mt-5 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl text-white ring-1 ring-inset ring-white/25 ${a.badge}`}
          >
            {emoji}
          </span>
          <p className={`eyebrow ${a.eyebrow}`}>{eyebrow}</p>
        </div>
        <h1 className="page-title mt-3.5">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        {children ? <div className="mt-4 flex flex-wrap items-center gap-3">{children}</div> : null}
      </div>
    </header>
  );
}
