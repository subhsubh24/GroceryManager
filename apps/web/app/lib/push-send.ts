import "server-only";
import webpush from "web-push";
import { loadEnv } from "@gm/config/env";
import { deletePushSubscription, getDb, listPushSubscriptions, withTenant } from "@gm/db";
import type { PushNotification } from "@gm/core/push";

let configured = false;

/** Configure web-push with the VAPID keys once. Returns false if keys aren't set. */
function ensureVapid(): boolean {
  const env = loadEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export interface SendResult {
  sent: number;
  pruned: number;
  skipped?: "no-vapid" | "no-subscriptions";
}

/**
 * Send a notification to every device a user has registered. Subscriptions the push service reports
 * as gone (404/410) are pruned. Runs each user's reads/writes inside withTenant (RLS-scoped).
 */
export async function sendNotificationToUser(
  userId: string,
  notification: PushNotification,
): Promise<SendResult> {
  if (!ensureVapid()) return { sent: 0, pruned: 0, skipped: "no-vapid" };

  const subs = await withTenant(getDb(), userId, (tx) => listPushSubscriptions(tx, userId));
  if (subs.length === 0) return { sent: 0, pruned: 0, skipped: "no-subscriptions" };

  const payload = JSON.stringify(notification);
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.endpoint);
        else console.error("web-push send failed", status, e);
      }
    }),
  );

  if (dead.length > 0) {
    await withTenant(getDb(), userId, async (tx) => {
      for (const endpoint of dead) await deletePushSubscription(tx, endpoint);
    });
  }
  return { sent, pruned: dead.length };
}
