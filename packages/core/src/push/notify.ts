/**
 * Web-push notification content (PLAN §10 proactive digest / run-out nudges). Pure + tested — the
 * actual send (web-push lib, VAPID) lives server-side in the app; this just shapes what to deliver.
 */
import type { DigestSummary } from "../digest/build.js";

export interface PushNotification {
  title: string;
  body: string;
  url: string;
}

/**
 * Map a weekly digest → a push notification, or null when there's nothing worth interrupting the
 * user for (quiet week). Returning null is how the cron avoids nagging — "only notify when it
 * changes a decision" (same information-gain discipline as the scan/preference prompts).
 */
export function buildDigestNotification(digest: DigestSummary): PushNotification | null {
  if (digest.isQuiet) return null;
  return { title: digest.headline, body: digest.subline, url: "/digest" };
}
