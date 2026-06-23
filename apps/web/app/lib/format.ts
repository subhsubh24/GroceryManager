/**
 * Display formatting — keep raw slugs / lowercase out of the UI so it reads like a finished product,
 * not a database dump. Canonical item names are stored lowercase (for matching) and enum values use
 * snake_case; these make them presentable. Pure, presentation-only.
 */

// Words that stay lowercase mid-phrase (but are capitalized if they lead).
const SMALL = new Set(["and", "or", "of", "the", "a", "an", "with", "in", "on", "to", "for"]);

/**
 * Title-case a name for display: "organic hass avocados" → "Organic Hass Avocados". Capitalizes the
 * first letter of each word (small connecting words stay lowercase unless first); preserves the rest
 * of a token so "2%", "1L" etc. survive.
 */
export function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      if (!w) return w;
      if (i > 0 && SMALL.has(w.toLowerCase())) return w.toLowerCase();
      // Lowercase the remainder so ALL-CAPS receipt text ("ORGANIC AVOCADO") also reads cleanly.
      return w[0]!.toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Humanize an enum / slug for display: "personal_care" → "Personal Care". */
export function humanize(s: string): string {
  return titleCase(s.replace(/[_-]+/g, " "));
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
