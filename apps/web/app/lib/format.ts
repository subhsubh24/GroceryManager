/**
 * Display formatting — keep raw slugs / lowercase out of the UI so it reads like a finished product,
 * not a database dump. Canonical item names are stored lowercase (for matching) and enum values use
 * snake_case; these make them presentable. Pure, presentation-only.
 *
 * `titleCase` is the framework-agnostic rule and lives in `@gm/core/format` so the web and native
 * surfaces share ONE implementation (the native app imports it directly via the `@gm/core/*` alias).
 * Re-exported here so this module stays the single web-side formatting entry point its consumers use.
 */

import { titleCase } from "@gm/core/format";

export { titleCase };

/** Humanize an enum / slug for display: "personal_care" → "Personal Care". */
export function humanize(s: string): string {
  return titleCase(s.replace(/[_-]+/g, " "));
}

/**
 * A friendly "where it came from" label from the latest purchase's source + retailer:
 * "instacart" → "Instacart", "whole_foods" → "Whole Foods", manual → "Added by you", barcode →
 * "Scanned". Returns null when there's nothing meaningful to show.
 */
export function sourceLabel(
  source: string | null | undefined,
  retailer: string | null | undefined,
): string | null {
  if (source === "manual") return "Added by you";
  if (source === "barcode") return "Scanned";
  if (retailer && retailer !== "other") return humanize(retailer); // Instacart / Whole Foods / Amazon
  if (source) return humanize(source.replace(/^gmail_/, "").replace(/_scrape$/, ""));
  return null;
}

/** Compact relative age for receipt/review dates: "today", "yesterday", "5d ago", "3mo ago", "1y ago". */
export function timeAgo(d: Date | string | null | undefined, now: Date = new Date()): string {
  if (!d) return "";
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return "";
  const days = Math.floor((now.getTime() - t) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
