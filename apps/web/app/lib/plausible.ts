declare global {
  interface Window {
    plausible?: (
      event: string,
      opts?: { props?: Record<string, string | number | boolean> },
    ) => void;
  }
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
