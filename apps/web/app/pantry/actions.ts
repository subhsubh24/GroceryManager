"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { loadEnv } from "@gm/config/env";
import { NORMALIZE } from "@gm/config/constants";
import { getDb, clearPantry, removePantryItem, withTenant } from "@gm/db";
import {
  backfillGmailForUser,
  createDbNormalizationPorts,
  syncGmailForUser,
  type GmailSyncSummary,
} from "@gm/core/ingestion";
import { appendLedgerAndReproject } from "@gm/core/pantry";
import { signIn } from "@/auth";
import { currentUserId } from "@/app/lib/tenant";

/**
 * Start the Google OAuth flow for the optional "Connect Gmail" receipt feature. Login is username +
 * password, so the default sign-in page is /signin; this kicks off Google specifically (gmail.readonly
 * scope). It runs while the user is already signed in, so the jwt callback ATTACHES Google to the
 * current account (attachGoogleToUser) and sets its email from the Google profile — never a 2nd user.
 * signIn throws a redirect to Google, so it runs outside any try/catch.
 */
export async function connectGmailAction() {
  await signIn("google", { redirectTo: "/pantry" });
}

/**
 * Truncate an error for the redirect query string. The raw Gemini 429 JSON is ~1.5KB and would blow
 * past URL length limits — so the redirect silently dropped the param and the banner never rendered.
 * The friendly mapper + "Details" toggle on /pantry work fine off the first few hundred chars.
 */
const shortError = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

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
    query = "error=" + encodeURIComponent(shortError(e));
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
    query = "error=" + encodeURIComponent(shortError(e));
  }
  redirect(`/pantry?${query}`);
}

/**
 * Remove an item from the pantry (per-row "Remove"). Hard removal — drops the ledger + projection for
 * this (user, item) via removePantryItem, so it's gone until re-purchased. RLS-scoped inside
 * withTenant; silent no-op on an empty id or signed-out user.
 */
export async function removePantryItemAction(formData: FormData) {
  const canonicalItemId = String(formData.get("canonicalItemId") ?? "");
  if (!canonicalItemId) return;
  const userId = await currentUserId();
  if (!userId) return;

  await withTenant(getDb(), userId, (tx) => removePantryItem(tx, userId, canonicalItemId));

  revalidatePath("/pantry");
}

/**
 * Manually add an item to the pantry. Resolves a canonical the same way ingestion does (trigram match
 * above threshold, else create one), then appends a `manual_adjust` ledger event so the quantity flows
 * through the normal projection. RLS-scoped inside withTenant; silent no-op on an empty name or
 * signed-out user. Quantity defaults to 1 and is clamped to a positive number.
 */
export async function addPantryItemAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const userId = await currentUserId();
  if (!userId) return;

  const rawQty = Number(formData.get("qty"));
  const qty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;

  await withTenant(getDb(), userId, async (tx) => {
    const ports = createDbNormalizationPorts(tx, userId);
    const [top] = await ports.trigramCandidates(name, 1);
    const canonicalItemId =
      top && top.score >= NORMALIZE.trigramThreshold ? top.id : await ports.createCanonical(name);

    await appendLedgerAndReproject(tx, {
      userId,
      canonicalItemId,
      baseQtyDelta: qty,
      eventType: "manual_adjust",
      confidence: 0.9,
      refType: "manual",
      refId: null,
      occurredAt: new Date(),
    });
  });

  revalidatePath("/pantry");
}

/**
 * Fresh start: wipe the whole pantry (projection + ledger + receipt history) so the user can rebuild
 * from a clean slate — re-import receipts, snap the fridge, etc. RLS-scoped; silent no-op if signed
 * out. Confirmed client-side (see clear-button.tsx) since it's destructive.
 */
export async function clearPantryAction() {
  const userId = await currentUserId();
  if (!userId) return;

  await withTenant(getDb(), userId, (tx) => clearPantry(tx, userId));

  revalidatePath("/pantry");
}
