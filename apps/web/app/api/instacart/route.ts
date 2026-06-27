import { NextResponse } from "next/server";
import { loadEnv } from "@gm/config/env";
import { getActiveListView, getDb, loadReorderInputs, withTenant } from "@gm/db";
import { buildCombinedInstacartPayload, buildDraftOrders, type ReorderInputRow } from "@gm/core/reorder";
import { instacart } from "@gm/core/integrations";
import { currentUserId } from "@/app/lib/tenant";
import { rateLimit, tooManyRequests } from "../_lib/rate-limit";

/**
 * Build the Instacart shopping-list page for the due items and redirect the user into Instacart
 * to check out (PLAN §7.1 — agentic up to one tap). Key-gated; no-op-with-message without a key.
 */
export async function POST() {
  const env = loadEnv();
  if (!env.INSTACART_API_KEY) {
    return NextResponse.json(
      { error: "Set INSTACART_API_KEY to enable Instacart ordering." },
      { status: 400 },
    );
  }
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "no user" }, { status: 400 });

  // Hits the paid Instacart API — throttle per user to prevent runaway external spend.
  const rl = rateLimit(`instacart:${userId}`, 10, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { rows, listItems } = await withTenant(getDb(), userId, async (tx) => ({
    rows: (await loadReorderInputs(tx, userId)) as ReorderInputRow[],
    listItems: await getActiveListView(tx, userId),
  }));
  const draft = buildDraftOrders(rows, {});
  // One cart: due staples + the active shopping list (manual quick-adds + plan gaps), deduped.
  const payload = buildCombinedInstacartPayload(
    draft.instacart.items,
    listItems.filter((i) => !i.checked).map((i) => ({ name: i.name })),
  );
  if (!payload) {
    return NextResponse.json({ error: "nothing to order" }, { status: 400 });
  }

  const client = new instacart.InstacartClient(env.INSTACART_API_KEY);
  const { url } = await client.createShoppingListPage(payload);
  return NextResponse.redirect(url, 303);
}
