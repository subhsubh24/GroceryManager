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
  if (env.CRON_SECRET) {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    const auth = req.headers.get("authorization");
    if (key !== env.CRON_SECRET && auth !== `Bearer ${env.CRON_SECRET}`) {
      return new NextResponse("forbidden", { status: 403 });
    }
  }

  const userIds = await listGoogleUserIds(getAdminDb());
  let renewed = 0;
  let ingested = 0;
  for (const userId of userIds) {
    try {
      await withTenant(getDb(), userId, async (tx) => {
        if (env.GMAIL_PUBSUB_TOPIC) {
          await renewGmailWatch(tx, env, userId, env.GMAIL_PUBSUB_TOPIC);
          renewed++;
        }
        const s = await syncGmailForUser(tx, env, userId, { maxMessages: 25 });
        ingested += s.ingested;
      });
    } catch (e) {
      console.error(`[cron/gmail] user ${userId} failed`, e);
    }
  }
  return NextResponse.json({ ok: true, users: userIds.length, renewed, ingested });
}
