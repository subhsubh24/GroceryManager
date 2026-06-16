"use server";

import { redirect } from "next/navigation";
import { loadEnv } from "@gm/config/env";
import { getDb } from "@gm/db";
import { backfillGmailForUser, syncGmailForUser, type GmailSyncSummary } from "@gm/core/ingestion";
import { currentUserId } from "@/app/lib/tenant";

function summaryQuery(summary: GmailSyncSummary): string {
  return new URLSearchParams({
    scanned: String(summary.scanned),
    ingested: String(summary.ingested),
    deduped: String(summary.deduped),
    lines: String(summary.linesIngested),
    review: String(summary.needsReview),
  }).toString();
}

/**
 * Manual "Sync receipts now" — runs the Gmail → pantry chain inline (no Redis/worker) for a bounded
 * batch, then redirects back to /pantry with a result summary. `redirect` throws to do its work, so
 * it's called AFTER the try/catch (never inside it).
 */
export async function syncGmailAction() {
  const userId = await currentUserId();
  if (!userId) redirect("/pantry?error=" + encodeURIComponent("Not signed in"));

  let query: string;
  try {
    query = summaryQuery(await syncGmailForUser(getDb(), loadEnv(), userId, { maxMessages: 10 }));
  } catch (e) {
    query = "error=" + encodeURIComponent(e instanceof Error ? e.message : String(e));
  }
  redirect(`/pantry?${query}`);
}

/**
 * "Import past receipts" — a bounded history backfill (last ~6 months) to seed the pantry on first
 * connect. Capped to fit a serverless request; for a full history run the worker's backfill:receipts.
 */
export async function backfillGmailAction() {
  const userId = await currentUserId();
  if (!userId) redirect("/pantry?error=" + encodeURIComponent("Not signed in"));

  let query: string;
  try {
    const summary = await backfillGmailForUser(getDb(), loadEnv(), userId, {
      sinceDays: 180,
      maxMessages: 25,
    });
    query = summaryQuery(summary);
  } catch (e) {
    query = "error=" + encodeURIComponent(e instanceof Error ? e.message : String(e));
  }
  redirect(`/pantry?${query}`);
}
