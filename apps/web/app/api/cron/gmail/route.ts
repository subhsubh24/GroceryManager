import { NextResponse } from "next/server";
import { loadEnv } from "@gm/config/env";
import { getAdminDb, getDb, listGoogleUserIds, withTenant } from "@gm/db";
import { renewGmailWatch, syncGmailForUser } from "@gm/core/ingestion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel-Cron entrypoint for the Gmail backbone (PLAN §5.1) — so it runs without the separate worker:
 * renew each user's Pub/Sub watch (≤7-day expiry) and run a fallback poll (covers dropped pushes).
 * Schedule daily in vercel.json. Guarded by CRON_SECRET (?key=… or Vercel's Authorization header).
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

  const userIds = await listGoogleUserIds(getAdminDb());
  let renewed = 0;
  let ingested = 0;
  for (const userId of userIds) {
    try {
      // Poll first (uses the existing cursor → catches dropped pushes), THEN renew the watch
      // (which preserves that cursor). Renewing first would skip un-synced history.
      const s = await syncGmailForUser(getDb(), env, userId, { maxMessages: 25 });
      ingested += s.ingested;
      if (env.GMAIL_PUBSUB_TOPIC) {
        await withTenant(getDb(), userId, (tx) =>
          renewGmailWatch(tx, env, userId, env.GMAIL_PUBSUB_TOPIC!),
        );
        renewed++;
      }
    } catch (e) {
      console.error(`[cron/gmail] user ${userId} failed`, e);
    }
  }
  return NextResponse.json({ ok: true, users: userIds.length, renewed, ingested });
}
