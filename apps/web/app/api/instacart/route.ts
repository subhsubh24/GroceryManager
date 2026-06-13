import { NextResponse } from "next/server";
import { loadEnv } from "@gm/config/env";
import { getDb, loadReorderInputs, withTenant } from "@gm/db";
import { buildDraftOrders, type ReorderInputRow } from "@gm/core/reorder";
import { instacart } from "@gm/core/integrations";
import { currentUserId } from "@/app/lib/tenant";

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

  const rows = (await withTenant(getDb(), userId, (tx) =>
    loadReorderInputs(tx, userId),
  )) as ReorderInputRow[];
  const draft = buildDraftOrders(rows, {});
  if (!draft.instacart.payload) {
    return NextResponse.json({ error: "nothing due for Instacart" }, { status: 400 });
  }

  const client = new instacart.InstacartClient(env.INSTACART_API_KEY);
  const { url } = await client.createShoppingListPage(draft.instacart.payload);
  return NextResponse.redirect(url, 303);
}
