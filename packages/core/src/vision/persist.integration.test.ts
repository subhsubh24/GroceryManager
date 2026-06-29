/**
 * Live end-to-end test for applyVisionScan (PLAN §5.6). Skipped unless TEST_DATABASE_URL is set, so
 * unit CI stays infra-free. Run locally against a migrated + seeded Postgres:
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/grocery_manager \
 *     pnpm --filter @gm/core test
 *
 * Proves the ledger-only invariant (§6): a reviewed scan re-grounds pantry_stock SOLELY through
 * appendLedgerAndReproject — no direct pantry_stock write — while still stamping
 * source="user_confirmed" and lastConfirmedAt on a confirmation, and seeding a new item as "derived".
 */
import { afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  canonicalItems,
  createDb,
  pantryStock,
  stockLedger,
  users,
} from "@gm/db";
import { createDbNormalizationPorts } from "../ingestion/db-ports.js";
import { applyVisionScan } from "./persist.js";
import type { ReconciledDetection } from "./reconcile.js";

const url = process.env.TEST_DATABASE_URL;

function confirm(canonicalItemId: string, rawLabel: string, qty: number): ReconciledDetection {
  return {
    rawLabel,
    action: "confirm_present",
    canonicalItemId,
    matchedName: rawLabel,
    presenceConfidence: 0.95,
    qtyEstimate: qty,
    newConfidence: 0.95,
  };
}

function newItem(rawLabel: string, qty: number): ReconciledDetection {
  return {
    rawLabel,
    action: "new_item",
    canonicalItemId: null,
    matchedName: null,
    presenceConfidence: 0.9,
    qtyEstimate: qty,
    newConfidence: null,
  };
}

describe.skipIf(!url)("applyVisionScan (live DB)", () => {
  const { db, client } = createDb(url!, 1);
  afterAll(async () => {
    await client.end();
  });

  it("confirms an out-of-stock item via the ledger (source=user_confirmed, no direct write)", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: `vision+${Date.now()}@example.com` })
      .returning({ id: users.id });
    const userId = user!.id;
    const ports = createDbNormalizationPorts(db, userId);

    // Seed a canonical + an OUT pantry row (qty 0, status out) the way the app would have left it.
    const canonicalItemId = await ports.createCanonical("olive oil");
    await db.insert(pantryStock).values({
      userId,
      canonicalItemId,
      baseQtyOnHand: "0",
      status: "out",
      source: "derived",
    });

    const res = await applyVisionScan(db, userId, {
      location: "pantry",
      model: "test",
      summary: "1 item",
      confirmations: [confirm(canonicalItemId, "olive oil", 1)],
      newItems: [],
    });
    expect(res.confirmed).toBe(1);

    const [stock] = await db
      .select()
      .from(pantryStock)
      .where(and(eq(pantryStock.userId, userId), eq(pantryStock.canonicalItemId, canonicalItemId)))
      .limit(1);
    // Re-grounded purely through the ledger/reproject path:
    expect(stock!.source).toBe("user_confirmed");
    expect(stock!.lastConfirmedAt).toBeTruthy();
    expect(stock!.status).toBe("in_stock"); // was empty → restored
    expect(Number(stock!.baseQtyOnHand)).toBeGreaterThan(0);

    // The vision_confirmed ledger event exists (the source of truth for the projection above).
    const events = await db
      .select({ type: stockLedger.eventType })
      .from(stockLedger)
      .where(and(eq(stockLedger.userId, userId), eq(stockLedger.canonicalItemId, canonicalItemId)));
    expect(events.some((e) => e.type === "vision_confirmed")).toBe(true);
  });

  it("seeds a brand-new scanned item as derived stock through the ledger", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: `vision2+${Date.now()}@example.com` })
      .returning({ id: users.id });
    const userId = user!.id;

    const res = await applyVisionScan(db, userId, {
      location: "fridge",
      model: "test",
      summary: "1 item",
      confirmations: [],
      newItems: [newItem("fresh basil", 1)],
    });
    expect(res.added).toBe(1);

    const [item] = await db
      .select({ id: canonicalItems.id })
      .from(canonicalItems)
      .where(eq(canonicalItems.slug, "fresh-basil"))
      .limit(1);
    expect(item).toBeTruthy();

    const [stock] = await db
      .select()
      .from(pantryStock)
      .where(and(eq(pantryStock.userId, userId), eq(pantryStock.canonicalItemId, item!.id)))
      .limit(1);
    expect(stock).toBeTruthy();
    expect(Number(stock!.baseQtyOnHand)).toBeGreaterThan(0);
    // new_item never asserts a user confirmation → stays the default provenance.
    expect(stock!.source).toBe("derived");
  });
});
