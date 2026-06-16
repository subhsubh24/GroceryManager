import { NextResponse } from "next/server";
import { loadEnv } from "@gm/config/env";
import { getAdminDb, getDb, listUserIdsWithPush, withTenant } from "@gm/db";
import { buildDigestNotification } from "@gm/core/push";
import { buildDigestForUser } from "@/app/lib/digest";
import { sendNotificationToUser } from "@/app/lib/push-send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly digest push (PLAN §10). Schedule in vercel.json, e.g. Sunday 5pm:
 *   { "path": "/api/cron/digest?key=<CRON_SECRET>", "schedule": "0 17 * * 0" }
 * Sends only when the user's week isn't quiet (buildDigestNotification returns null otherwise).
 */
export async function GET(req: Request) {
  const env = loadEnv();
  if (env.CRON_SECRET) {
    const key = new URL(req.url).searchParams.get("key");
    const auth = req.headers.get("authorization");
    if (key !== env.CRON_SECRET && auth !== `Bearer ${env.CRON_SECRET}`) {
      return new NextResponse("forbidden", { status: 403 });
    }
  }

  const userIds = await listUserIdsWithPush(getAdminDb());
  let notified = 0;
  for (const userId of userIds) {
    try {
      const digest = await withTenant(getDb(), userId, (tx) => buildDigestForUser(tx, userId));
      const notification = buildDigestNotification(digest);
      if (!notification) continue; // quiet week — don't nag
      const res = await sendNotificationToUser(userId, notification);
      if (res.sent > 0) notified++;
    } catch (e) {
      console.error(`[cron/digest] user ${userId} failed`, e);
    }
  }
  return NextResponse.json({ ok: true, users: userIds.length, notified });
}
