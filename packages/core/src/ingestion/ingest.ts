/**
 * Receipt ingestion orchestrator (PLAN §5.1). Ties the spine together:
 *   dedup → extract → per line: normalize → resolve baseQty (units) → upsert line →
 *   (if confident) append ledger + reproject pantry. Idempotent on (userId, gmailMessageId).
 *
 * `extract` is injected (the real one wraps the Gemini client via extractReceipt); this keeps
 * the orchestrator testable end-to-end against a live DB with a stubbed extractor.
 */
import { and, eq } from "drizzle-orm";
import type { Querier } from "@gm/db";
import { canonicalItems, purchaseLineItems, purchases, unitsOfMeasure } from "@gm/db";
import type { PurchaseSource, ReceiptExtraction } from "@gm/shared";
import { UnitConverter, type Dimension } from "../units/index.js";
import { appendLedgerAndReproject } from "../pantry/persist.js";
import { normalizeLineItem, type NormalizationPorts } from "./normalize.js";

export interface IngestDeps {
  db: Querier;
  ports: NormalizationPorts;
  extract: (cleanedText: string) => Promise<ReceiptExtraction>;
}

export interface IngestInput {
  userId: string;
  source: PurchaseSource;
  gmailMessageId?: string | null;
  cleanedText: string;
}

export interface IngestResult {
  purchaseId: string | null;
  linesIngested: number;
  /**
   * Line items actually written to the pantry ledger (confidently resolved). This is
   * `linesIngested - needsReview` — the rest are parked in the Review inbox and are NOT yet in the
   * pantry, so user-facing "added to your pantry" copy must use THIS count, not `linesIngested`.
   */
  addedToPantry: number;
  needsReview: number;
  deduped: boolean;
}

/**
 * Coerce an LLM-provided purchase date to a valid Date, falling back to `now` on missing/invalid
 * input — the model occasionally emits an unparseable string (→ Invalid Date), which otherwise throws
 * `RangeError: Invalid time value` when serialized to the timestamp column and fails the whole receipt.
 */
export function coercePurchasedAt(value: string | null | undefined, now: Date = new Date()): Date {
  if (!value) return now;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? now : d;
}

export async function ingestReceipt(deps: IngestDeps, input: IngestInput): Promise<IngestResult> {
  const { db } = deps;

  // Idempotency: one Gmail message → one Purchase.
  if (input.gmailMessageId) {
    const existing = await db
      .select({ id: purchases.id })
      .from(purchases)
      .where(and(eq(purchases.userId, input.userId), eq(purchases.gmailMessageId, input.gmailMessageId)))
      .limit(1);
    if (existing[0]) {
      return { purchaseId: existing[0].id, linesIngested: 0, addedToPantry: 0, needsReview: 0, deduped: true };
    }
  }

  const extraction = await deps.extract(input.cleanedText);

  const unitRows = await db.select().from(unitsOfMeasure);
  const converter = new UnitConverter(
    unitRows.map((u) => ({
      code: u.code,
      dimension: u.dimension as Dimension,
      toBaseFactor: u.toBaseFactor != null ? Number(u.toBaseFactor) : null,
    })),
  );
  const unitByCode = new Map(unitRows.map((u) => [u.code, u]));
  const unitById = new Map(unitRows.map((u) => [u.id, u]));

  // The LLM can return a malformed date string (→ Invalid Date), which throws when serialized to the
  // timestamp column and fails the whole receipt. coercePurchasedAt validates + falls back to now.
  const purchasedAt = coercePurchasedAt(extraction.purchasedAt);
  const purchaseRows = await db
    .insert(purchases)
    .values({
      userId: input.userId,
      source: input.source,
      retailer: extraction.retailer,
      externalOrderId: extraction.externalOrderId,
      gmailMessageId: input.gmailMessageId ?? null,
      purchasedAt,
      totalCents: extraction.totalCents ?? null,
      currency: extraction.currency,
      status: "parsed",
    })
    .returning({ id: purchases.id });
  const purchaseId = purchaseRows[0]!.id;

  let needsReview = 0;
  let lines = 0;
  let addedToPantry = 0;

  for (const li of extraction.lineItems) {
    const norm = await normalizeLineItem({ rawText: li.rawText, name: li.name, upc: li.upc }, deps.ports);

    // Resolve baseQty in the canonical item's base unit.
    let baseQty: number | null = null;
    if (norm.canonicalItemId && li.quantity != null && li.unitText) {
      const itemRows = await db
        .select({ baseUnitId: canonicalItems.baseUnitId })
        .from(canonicalItems)
        .where(eq(canonicalItems.id, norm.canonicalItemId))
        .limit(1);
      const baseUnit = itemRows[0] ? unitById.get(itemRows[0].baseUnitId) : undefined;
      const fromUnit = unitByCode.get(li.unitText.toLowerCase());
      if (baseUnit && fromUnit) {
        const conv = converter.convert(li.quantity, fromUnit.code, baseUnit.code);
        baseQty = conv ? conv.qty : null;
      }
    }

    const needs = norm.needsReview || norm.canonicalItemId == null || baseQty == null;
    if (needs) needsReview++;

    const parsedUnitId = li.unitText ? (unitByCode.get(li.unitText.toLowerCase())?.id ?? null) : null;
    const lineRows = await db
      .insert(purchaseLineItems)
      .values({
        purchaseId,
        canonicalItemId: norm.canonicalItemId,
        rawText: li.rawText,
        rawUnitText: li.unitText,
        parsedQty: li.quantity != null ? String(li.quantity) : null,
        parsedUnitId,
        baseQty: baseQty != null ? String(baseQty) : null,
        unitPriceCents: li.unitPriceCents,
        lineTotalCents: li.lineTotalCents,
        matchConfidence: norm.confidence,
        matchMethod: norm.method,
        needsReview: needs,
      })
      .returning({ id: purchaseLineItems.id });
    lines++;

    if (!needs && norm.canonicalItemId && baseQty != null) {
      await appendLedgerAndReproject(db, {
        userId: input.userId,
        canonicalItemId: norm.canonicalItemId,
        baseQtyDelta: baseQty,
        eventType: "purchase",
        confidence: norm.confidence,
        refType: "purchase_line_item",
        refId: lineRows[0]!.id,
        occurredAt: purchasedAt,
      });
      addedToPantry++;
    }
  }

  if (needsReview > 0) {
    await db.update(purchases).set({ status: "needs_review" }).where(eq(purchases.id, purchaseId));
  }

  return { purchaseId, linesIngested: lines, addedToPantry, needsReview, deduped: false };
}
