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
