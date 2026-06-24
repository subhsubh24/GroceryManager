import { NextResponse } from "next/server";
import { loadEnv } from "@gm/config/env";
import {
  getAdminDb,
  getDb,
  listUserIdsWithPhone,
  listUserIdsWithPush,
  withTenant,
} from "@gm/db";
import { buildDigestNotification, buildDigestSms } from "@gm/core/push";
import { buildDigestForUser } from "@/app/lib/digest";
import { sendNotificationToUser } from "@/app/lib/push-send";
import { sendSmsToUser } from "@/app/lib/sms-send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly digest push (PLAN §10). Schedule in vercel.json, e.g. Sunday 5pm:
 *   { "path": "/api/cron/digest?key=<CRON_SECRET>", "schedule": "0 17 * * 0" }
 * Sends only when the user's week isn't quiet (buildDigestNotification returns null otherwise).
 */
export async function GET(req: Request) {
  const env = loadEnv();
  const isAuthorized = (() => {
    if (!env.CRON_SECRET) return process.env.NODE_ENV !== "production";
    const key = new URL(req.url).searchParams.get("key");
    const auth = req.headers.get("authorization");
    return key === env.CRON_SECRET || auth === `Bearer ${env.CRON_SECRET}`;
  })();
  if (!isAuthorized) return new NextResponse("forbidden", { status: 403 });

  // Everyone reachable on either channel: a web-push subscription and/or a phone on file.
  const [pushIds, phoneIds] = await Promise.all([
    listUserIdsWithPush(getAdminDb()),
    listUserIdsWithPhone(getAdminDb()),
  ]);
  const userIds = [...new Set([...pushIds, ...phoneIds])];

  let notified = 0;
  let texted = 0;
  for (const userId of userIds) {
    try {
      const digest = await withTenant(getDb(), userId, (tx) => buildDigestForUser(tx, userId));
      const notification = buildDigestNotification(digest);
      if (!notification) continue; // quiet week — don't nag on any channel

      const push = await sendNotificationToUser(userId, notification);
      if (push.sent > 0) notified++;

      const sms = buildDigestSms(digest, env.APP_URL);
      if (sms) {
        const res = await sendSmsToUser(userId, sms);
        if (res.sent > 0) texted++;
      }
    } catch (e) {
      console.error(`[cron/digest] user ${userId} failed`, e);
    }
  }
  return NextResponse.json({ ok: true, users: userIds.length, notified, texted });
}
