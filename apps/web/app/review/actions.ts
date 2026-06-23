"use server";

import { revalidatePath } from "next/cache";
import {
  addMatchOverride,
  clearReviewGroup,
  getDb,
  getReviewLineItem,
  withTenant,
} from "@gm/db";
import { appendLedgerAndReproject } from "@gm/core/pantry";
import { createDbNormalizationPorts } from "@gm/core/ingestion";
import { currentUserId } from "@/app/lib/tenant";

/**
 * Confirm a low-confidence review item → add it to the pantry (the ratchet). Resolves a canonical
 * (the best-guess match, else create one from the raw text), appends a `purchase` ledger event so the
 * quantity flows through the same projection as a synced receipt, teaches a raw-text → canonical
 * override for next time, and clears the needs-review flag. All RLS-scoped inside withTenant; never
 * throws out to the client (a bad/empty id or signed-out user is a silent no-op).
 */
export async function confirmReviewItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const userId = await currentUserId();
  if (!userId) return;

  await withTenant(getDb(), userId, async (tx) => {
    const item = await getReviewLineItem(tx, userId, id);
    if (!item) return;

    const canonicalItemId =
      item.canonicalItemId ??
      (await createDbNormalizationPorts(tx, userId).createCanonical(item.rawText ?? "item"));

    const delta = item.baseQty ?? item.quantity ?? 1;
    const baseQtyDelta = delta > 0 ? delta : 1;

    await appendLedgerAndReproject(tx, {
      userId,
      canonicalItemId,
      baseQtyDelta,
      eventType: "purchase",
      confidence: 0.6,
      refType: "purchase_line_item",
      refId: item.id,
      occurredAt: item.purchasedAt,
    });

    if (item.rawText) await addMatchOverride(tx, userId, item.rawText, canonicalItemId);

    // Clear the whole group — confirming one row also clears the same item's duplicate purchases.
    await clearReviewGroup(tx, userId, { canonicalItemId: item.canonicalItemId, rawText: item.rawText });
  });

  revalidatePath("/pantry");
  revalidatePath("/review");
}

/**
 * Dismiss a review item as not-mine / not-trackable — just clear the needs-review flag (no pantry
 * change). RLS-scoped; silent no-op on an empty id or signed-out user.
 */
export async function dismissReviewItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const userId = await currentUserId();
  if (!userId) return;

  await withTenant(getDb(), userId, async (tx) => {
    const item = await getReviewLineItem(tx, userId, id);
    if (!item) return;
    await clearReviewGroup(tx, userId, { canonicalItemId: item.canonicalItemId, rawText: item.rawText });
  });

  revalidatePath("/pantry");
  revalidatePath("/review");
}
