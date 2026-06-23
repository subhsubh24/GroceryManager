"use server";

import { revalidatePath } from "next/cache";
import {
  addMatchOverride,
  clearReviewGroup,
  getDb,
  getReviewLineItem,
  withTenant,
  type Querier,
} from "@gm/db";
import { appendLedgerAndReproject } from "@gm/core/pantry";
import { createDbNormalizationPorts } from "@gm/core/ingestion";
import { currentUserId } from "@/app/lib/tenant";

/** Confirm one review line into the pantry (resolve canonical → ledger purchase → learn override →
 *  clear the whole duplicate group). Runs inside a caller-provided tenant tx. */
async function confirmOne(tx: Querier, userId: string, id: string) {
  const item = await getReviewLineItem(tx, userId, id);
  if (!item) return;
  const canonicalItemId =
    item.canonicalItemId ??
    (await createDbNormalizationPorts(tx, userId).createCanonical(item.rawText ?? "item"));
  const delta = item.baseQty ?? item.quantity ?? 1;
  await appendLedgerAndReproject(tx, {
    userId,
    canonicalItemId,
    baseQtyDelta: delta > 0 ? delta : 1,
    eventType: "purchase",
    confidence: 0.6,
    refType: "purchase_line_item",
    refId: item.id,
    occurredAt: item.purchasedAt,
  });
  if (item.rawText) await addMatchOverride(tx, userId, item.rawText, canonicalItemId);
  await clearReviewGroup(tx, userId, { canonicalItemId: item.canonicalItemId, rawText: item.rawText });
}

/** Dismiss one review line (not mine / expired) — clears it and its duplicate group, no pantry change. */
async function dismissOne(tx: Querier, userId: string, id: string) {
  const item = await getReviewLineItem(tx, userId, id);
  if (!item) return;
  await clearReviewGroup(tx, userId, { canonicalItemId: item.canonicalItemId, rawText: item.rawText });
}

/**
 * Bulk-confirm reviewed items → add each to the pantry. Each runs in its OWN tenant tx so one bad
 * item can't roll back the rest of the batch. Silent no-op when signed out or nothing selected.
 */
export async function confirmReviewItems(ids: string[]) {
  const userId = await currentUserId();
  if (!userId || ids.length === 0) return;
  for (const id of ids) {
    try {
      await withTenant(getDb(), userId, (tx) => confirmOne(tx, userId, id));
    } catch {
      /* skip a bad one, keep going */
    }
  }
  revalidatePath("/pantry");
  revalidatePath("/review");
}

/** Bulk-dismiss reviewed items (not mine / expired) — clears each item + its duplicate group. */
export async function dismissReviewItems(ids: string[]) {
  const userId = await currentUserId();
  if (!userId || ids.length === 0) return;
  for (const id of ids) {
    try {
      await withTenant(getDb(), userId, (tx) => dismissOne(tx, userId, id));
    } catch {
      /* skip */
    }
  }
  revalidatePath("/pantry");
  revalidatePath("/review");
}
