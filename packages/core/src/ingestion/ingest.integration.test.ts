/**
 * Live end-to-end ingestion test (PLAN §12). Skipped unless TEST_DATABASE_URL is set, so
 * unit CI stays infra-free. Run locally against a migrated+seeded Postgres:
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/grocery_manager \
 *     pnpm --filter @gm/core test
 */
import { afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { canonicalItems, createDb, pantryStock, users } from "@gm/db";
import type { ReceiptExtraction } from "@gm/shared";
import { createDbNormalizationPorts } from "./db-ports.js";
import { ingestReceipt } from "./ingest.js";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("ingestReceipt (live DB)", () => {
  const { db, client } = createDb(url!, 1);
  afterAll(async () => {
    await client.end();
  });

  it("receipt → purchase + pantry stock; flags unknowns; idempotent", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: `test+${Date.now()}@example.com` })
      .returning({ id: users.id });
    const userId = user!.id;
    const ports = createDbNormalizationPorts(db, userId);

    const extraction: ReceiptExtraction = {
      retailer: "whole_foods",
      externalOrderId: "T-1",
      purchasedAt: new Date().toISOString(),
      currency: "USD",
      totalCents: 1148,
      lineItems: [
        { rawText: "365 WHOLE MILK", name: "whole milk", brand: null, upc: null, quantity: 1, unitText: "l", packageSize: "1 l", unitPriceCents: 349, lineTotalCents: 349, confidence: 0.95 },
        { rawText: "LARGE EGGS", name: "large egg", brand: null, upc: null, quantity: 12, unitText: "each", packageSize: "12 ct", unitPriceCents: 0, lineTotalCents: 0, confidence: 0.9 },
        { rawText: "MYSTERY SNACK", name: "zzqqx unknown snack", brand: null, upc: null, quantity: 1, unitText: "each", packageSize: null, unitPriceCents: 799, lineTotalCents: 799, confidence: 0.5 },
      ],
    };

    const gmid = `m-${Date.now()}`;
    const res = await ingestReceipt(
      { db, ports, extract: async () => extraction },
      { userId, source: "gmail_wfm", gmailMessageId: gmid, cleanedText: "..." },
    );

    expect(res.deduped).toBe(false);
    expect(res.linesIngested).toBe(3);
    expect(res.needsReview).toBeGreaterThanOrEqual(1); // the mystery snack

    // Milk should be on hand at ~1000 ml (1 l → ml).
    const milk = (
      await db.select({ id: canonicalItems.id }).from(canonicalItems).where(eq(canonicalItems.slug, "whole-milk")).limit(1)
    )[0];
    const milkStock = (
      await db
        .select()
        .from(pantryStock)
        .where(and(eq(pantryStock.userId, userId), eq(pantryStock.canonicalItemId, milk!.id)))
        .limit(1)
    )[0];
    expect(milkStock).toBeTruthy();
    expect(Number(milkStock!.baseQtyOnHand)).toBeCloseTo(1000, 3);

    // Re-ingesting the same Gmail message is a no-op.
    const dup = await ingestReceipt(
      { db, ports, extract: async () => extraction },
      { userId, source: "gmail_wfm", gmailMessageId: gmid, cleanedText: "..." },
    );
    expect(dup.deduped).toBe(true);
    expect(dup.linesIngested).toBe(0);
  });
});
