/**
 * Display formatting — framework-agnostic, dependency-free string helpers shared by every surface
 * (web render, mobile render, the mobile DTO mappers). Keeping raw slugs / lowercase out of the UI is
 * a product rule (see CLAUDE.md: "never show raw slugs"); canonical item names are stored lowercase
 * for matching, so they must be title-cased for display. Living in `@gm/core` gives every consumer —
 * including the workspace-excluded native app, which imports via the `@gm/core/*` path alias — ONE
 * source of truth for the rule, so the web and mobile surfaces can never silently drift apart.
 */

// Words that stay lowercase mid-phrase (but are capitalized if they lead).
const SMALL = new Set(["and", "or", "of", "the", "a", "an", "with", "in", "on", "to", "for"]);

/**
 * Title-case a name for display: "organic hass avocados" → "Organic Hass Avocados". Capitalizes the
 * first letter of each word (small connecting words stay lowercase unless first) and lowercases the
 * remainder so ALL-CAPS receipt text ("ORGANIC AVOCADO") also reads cleanly. Whitespace is collapsed;
 * an empty/blank input returns "" (never throws).
 */
export function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      if (!w) return w;
      if (i > 0 && SMALL.has(w.toLowerCase())) return w.toLowerCase();
      return w[0]!.toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}
