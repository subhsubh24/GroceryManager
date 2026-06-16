"use server";

import { getDb, withTenant } from "@gm/db";
import { captureToList } from "@gm/core/capture";
import { isValidUpc, lookupBarcode } from "@gm/core/integrations/openfoodfacts";
import { currentUserId } from "@/app/lib/tenant";

/**
 * Look up a scanned/typed barcode on Open Food Facts and add the resolved product to the active
 * shopping list. Reuses the SAME add path as addNamesToListAction (currentUserId → withTenant →
 * captureToList), so the write is RLS-scoped to the signed-in user. Degrades gracefully via the
 * `reason` codes: invalid digits, not-found barcode, no session, or an unexpected error all return
 * `{ ok:false }` instead of throwing.
 */
export async function addScannedItemAction(
  upc: string,
): Promise<{ ok: boolean; name?: string; reason?: string }> {
  try {
    if (!isValidUpc(upc)) return { ok: false, reason: "invalid" };

    const found = await lookupBarcode(upc);
    if (!found) return { ok: false, reason: "notfound" };

    const userId = await currentUserId();
    if (!userId) return { ok: false, reason: "auth" };

    await withTenant(getDb(), userId, (tx) =>
      captureToList(tx, userId, [{ name: found.name }], { reason: "manual" }),
    );
    return { ok: true, name: found.name };
  } catch {
    return { ok: false, reason: "error" };
  }
}
