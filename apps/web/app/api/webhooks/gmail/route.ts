import { NextResponse } from "next/server";
import { loadEnv } from "@gm/config/env";
import { getAdminDb, getDb, getUserIdByEmail } from "@gm/db";
import { gmail } from "@gm/core/integrations";
import { syncGmailForUser } from "@gm/core/ingestion";

export const dynamic = "force-dynamic";

/**
 * Gmail Pub/Sub push endpoint (PLAN §5.1). The push delivers only { emailAddress, historyId }; we map
 * the address → userId and run a bounded inline sync (no Redis/worker needed — works on Vercel). We
 * always ack (2xx) so Pub/Sub doesn't hammer retries; the hourly poll/cron catches anything missed.
 *
 * Guard: a shared secret in the push endpoint URL (?token=…). Full OIDC token verification is the
 * production hardening; the secret is adequate to stop arbitrary triggering for personal use.
 */
export async function POST(req: Request) {
  const env = loadEnv();
  const isAuthorized = (() => {
    if (!env.GMAIL_WEBHOOK_SECRET) return process.env.NODE_ENV !== "production";
    const token = new URL(req.url).searchParams.get("token");
    return token === env.GMAIL_WEBHOOK_SECRET;
  })();
  if (!isAuthorized) return new NextResponse("forbidden", { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }

  const note = gmail.parsePubSubMessage(body);
  if (!note) return new NextResponse(null, { status: 204 }); // ack malformed/empty, don't retry

  try {
    const userId = await getUserIdByEmail(getAdminDb(), note.emailAddress);
    if (userId) {
      await syncGmailForUser(getDb(), env, userId, { maxMessages: 10 });
    }
  } catch (e) {
    // Ack anyway — retrying won't help a transient extract failure; the poll/cron will reconcile.
    console.error("gmail webhook sync failed", e);
  }
  return new NextResponse(null, { status: 204 });
}
