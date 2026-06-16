"use server";

import { deletePushSubscription, getDb, savePushSubscription, withTenant } from "@gm/db";
import { buildDigestNotification } from "@gm/core/push";
import { currentUserId } from "@/app/lib/tenant";
import { buildDigestForUser } from "@/app/lib/digest";
import { sendNotificationToUser } from "@/app/lib/push-send";

export interface PushSubInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function savePushSubscriptionAction(sub: PushSubInput): Promise<{ ok: boolean }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false };
  await withTenant(getDb(), userId, (tx) => savePushSubscription(tx, userId, sub));
  return { ok: true };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<{ ok: boolean }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false };
  await withTenant(getDb(), userId, (tx) => deletePushSubscription(tx, endpoint));
  return { ok: true };
}

/** Send the user their current digest as a push (or a plain test note on a quiet week). */
export async function sendTestPushAction(): Promise<{ ok: boolean; message: string }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "Not signed in." };
  const digest = await withTenant(getDb(), userId, (tx) => buildDigestForUser(tx, userId));
  const notification = buildDigestNotification(digest) ?? {
    title: "GroceryManager",
    body: "Notifications are on — you'll get your Sunday briefing here.",
    url: "/digest",
  };
  const res = await sendNotificationToUser(userId, notification);
  if (res.skipped === "no-vapid") return { ok: false, message: "Notifications aren't configured (set VAPID keys)." };
  if (res.skipped === "no-subscriptions") return { ok: false, message: "No device is subscribed yet." };
  return { ok: true, message: `Sent to ${res.sent} device${res.sent === 1 ? "" : "s"}.` };
}
