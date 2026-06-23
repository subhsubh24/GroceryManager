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

const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Map a weekly digest → an SMS body, or null on a quiet week (same don't-nag discipline as push).
 * Includes the headline, the top reorder items (so you can shop straight from the text), and a link
 * to the list when an absolute app URL is configured.
 */
export function buildDigestSms(digest: DigestSummary, appUrl?: string | null): string | null {
  if (digest.isQuiet) return null;
  const items = digest.topReorder.slice(0, 6).map((r) => cap(r.name));
  const need = items.length ? ` Need: ${items.join(", ")}.` : "";
  const link = appUrl ? ` ${appUrl.replace(/\/+$/, "")}/list` : "";
  return `GroceryManager — ${digest.headline}${need}${link}`.trim();
}
