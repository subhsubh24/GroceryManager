/**
 * Add quick-captured items to the active shopping list (PLAN §10). Reuses the normalization ports
 * (trigram match → else create a canonical, exactly like §5.4) and the active-list helper. Must run
 * inside withTenant — every write is RLS-scoped to the user.
 */
import { NORMALIZE } from "@gm/config/constants";
import { getOrCreateActiveList, shoppingListItems, type Querier } from "@gm/db";
import { createDbNormalizationPorts } from "../ingestion/db-ports.js";
import type { ParsedCaptureItem } from "./parse.js";

export interface CaptureResult {
  listId: string | null;
  added: number;
}

export async function captureToList(
  db: Querier,
  userId: string,
  items: ParsedCaptureItem[],
): Promise<CaptureResult> {
  if (items.length === 0) return { listId: null, added: 0 };
  const ports = createDbNormalizationPorts(db, userId);
  const listId = await getOrCreateActiveList(db, userId);

  let added = 0;
  for (const item of items) {
    const [top] = await ports.trigramCandidates(item.name, 1);
    const canonicalItemId =
      top && top.score >= NORMALIZE.trigramThreshold ? top.id : await ports.createCanonical(item.name);
    await db.insert(shoppingListItems).values({ shoppingListId: listId, canonicalItemId, reason: "manual" });
    added += 1;
  }
  return { listId, added };
}
