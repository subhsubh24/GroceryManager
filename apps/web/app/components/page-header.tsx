import type { ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "@/app/components/icons";

/**
 * Shared, calm page header — one quiet treatment for every interior screen: a neutral icon tile, a
 * muted eyebrow, and a clean title. The `accent` prop is kept in the signature (so the many pages
 * that pass `accent="berry"` etc. still compile) but is intentionally ignored — there is a single
 * accent (brand green) used sparingly elsewhere, and no per-page color themes or glows.
 *
 * Presentation-only. `topRight` holds a secondary link/action on the back-link row; `children`
 * render directly under the subtitle (e.g. a CTA button or filter tabs).
 */
export type Accent = "brand" | "berry" | "grape" | "ocean" | "citrus" | "sunset";

export function PageHeader({
  // Accepted for back-compat with existing callers; deliberately not used (one calm header for all).
  accent: _accent = "brand",
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  back = { href: "/", label: "Home" },
  topRight,
  children,
}: {
  accent?: Accent;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string } | null;
  topRight?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="relative">
      {(back || topRight) && (
        <div className="flex items-center justify-between gap-3">
          {back ? (
            <a href={back.href} className="back-link">
              <ArrowLeft className="h-4 w-4" /> {back.label}
            </a>
          ) : (
            <span />
          )}
          {topRight}
        </div>
      )}
      <div className="mt-5 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <span className="tile h-12 w-12">
            <Icon className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="eyebrow">{eyebrow}</p>
        </div>
        <h1 className="page-title mt-3.5">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        {children ? <div className="mt-4 flex flex-wrap items-center gap-3">{children}</div> : null}
      </div>
    </header>
  );
}
