declare global {
  interface Window {
    plausible?: (
      event: string,
      opts?: { props?: Record<string, string | number | boolean> },
    ) => void;
  }
}

/**
 * Normalize NEXT_PUBLIC_PLAUSIBLE_DOMAIN to the bare host Plausible expects.
 *
 * Plausible's `data-domain` (tracking) and `site_id` (Stats API) must be the
 * bare host — no scheme, no path, no trailing slash — and must match EXACTLY
 * the domain registered in the Plausible dashboard. Operators routinely paste a
 * full URL (e.g. "https://grocery-manager-web.vercel.app/"); Plausible then
 * rejects every event ("Plausible test event is not for this site") and the
 * Stats API 404s. Normalizing defensively means a full-URL env value still
 * produces a working integration. Returns undefined when nothing usable remains.
 */
export function normalizePlausibleDomain(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const host = raw
    .trim()
    .replace(/^https?:\/\//i, "") // strip scheme
    .replace(/\/.*$/, "") // strip path / query / trailing slash (everything from the first slash)
    .replace(/\s+/g, ""); // strip stray whitespace
  return host || undefined;
}

/**
 * Fire a Plausible custom event. Safe to call when Plausible is not loaded
 * (no-op in dev/test or when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is unset).
 * Never throws.
 */
export function trackEvent(
  name: string,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;
  window.plausible?.(name, props ? { props } : undefined);
}
