"use server";

import { revalidatePath } from "next/cache";
import {
  addMatchOverride,
  appendPreferenceSignal,
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

/**
 * Why a reviewed line is being dismissed. Functionally all three mean the same thing for a review
 * line — it should NOT enter the *current* pantry — but the reason is honest in the UI and is worth
 * learning from: "expired" is a waste signal, "not mine" is a parse correction.
 */
export type DismissReason = "used" | "expired" | "not_mine";

/** Clear one review line (and its duplicate group); returns the raw text so the caller can learn. */
async function dismissOne(tx: Querier, userId: string, id: string): Promise<string | null> {
  const item = await getReviewLineItem(tx, userId, id);
  if (!item) return null;
  await clearReviewGroup(tx, userId, { canonicalItemId: item.canonicalItemId, rawText: item.rawText });
  return item.rawText;
}

/** The ratchet: turn a dismissal reason into a preference signal (or none). */
function dismissSignal(reason: DismissReason, userId: string, rawText: string) {
  if (reason === "expired")
    return { userId, topic: "waste:expired", value: rawText, polarity: "negative" as const, source: "waste" as const, confidence: 0.8 };
  if (reason === "not_mine")
    return { userId, topic: "mismatch", value: rawText, polarity: "negative" as const, source: "correction" as const, confidence: 0.6 };
  return null; // "used" = normal consumption of an untracked line — nothing to learn
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

/**
 * Bulk-dismiss reviewed items with a reason (used / expired / not mine). Each clear runs in its own
 * tenant tx; the optional learning signal is written in a SEPARATE best-effort tx so a signal write
 * can never roll back (or block) the dismiss itself.
 */
export async function dismissReviewItems(ids: string[], reason: DismissReason = "not_mine") {
  const userId = await currentUserId();
  if (!userId || ids.length === 0) return;
  for (const id of ids) {
    let rawText: string | null = null;
    try {
      rawText = await withTenant(getDb(), userId, (tx) => dismissOne(tx, userId, id));
    } catch {
      continue; // couldn't clear this one — skip, don't try to learn from it
    }
    if (rawText) {
      const sig = dismissSignal(reason, userId, rawText);
      if (sig) {
        try {
          await withTenant(getDb(), userId, (tx) => appendPreferenceSignal(tx, sig));
        } catch {
          /* best-effort ratchet — never block the dismiss */
        }
      }
    }
  }
  revalidatePath("/pantry");
  revalidatePath("/review");
}
