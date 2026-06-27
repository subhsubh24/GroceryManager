"use client";

import { useEffect } from "react";
import { trackEvent } from "@/app/lib/plausible";

/**
 * Fire a named Plausible event on mount. Use in server component pages to track
 * page-level events without converting the whole page to a client component.
 *
 * Example:
 *   <PlausiblePageview event="landing_view" />
 *   <PlausiblePageview event="upgrade_view" props={{ plan: "monthly" }} />
 */
export function PlausiblePageview({
  event,
  props,
}: {
  event: string;
  props?: Record<string, string>;
}) {
  useEffect(() => {
    trackEvent(event, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
