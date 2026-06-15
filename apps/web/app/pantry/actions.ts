"use server";

import { redirect } from "next/navigation";
import { loadEnv } from "@gm/config/env";
import { getDb, withTenant } from "@gm/db";
import { syncGmailForUser } from "@gm/core/ingestion";
import { currentUserId } from "@/app/lib/tenant";

/**
 * Manual "Sync receipts now" — runs the Gmail → pantry chain inline (no Redis/worker) for a bounded
 * batch, then redirects back to /pantry with a result summary in the query string. `redirect` throws
 * to do its work, so it's called AFTER the try/catch (never inside it).
 */
export async function syncGmailAction() {
  const userId = await currentUserId();
  if (!userId) redirect("/pantry?error=" + encodeURIComponent("Not signed in"));

  let query: string;
  try {
    const summary = await withTenant(getDb(), userId, (tx) =>
      syncGmailForUser(tx, loadEnv(), userId, { maxMessages: 10 }),
    );
    const p = new URLSearchParams({
      scanned: String(summary.scanned),
      ingested: String(summary.ingested),
      deduped: String(summary.deduped),
      lines: String(summary.linesIngested),
      review: String(summary.needsReview),
    });
    query = p.toString();
  } catch (e) {
    query = "error=" + encodeURIComponent(e instanceof Error ? e.message : String(e));
  }
  redirect(`/pantry?${query}`);
}
