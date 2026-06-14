/**
 * Persist a reviewed vision scan (PLAN §5.6). Must run inside withTenant — every write is
 * RLS-scoped to the user. Semantics mirror the §5.6 rules exactly:
 *
 *   confirm_present → append a `vision_confirmed` ledger event at `now` (resets the confidence
 *     decay clock, preserving the learned rate; restores an out/expired item to in_stock) and
 *     stamp `lastConfirmedAt` / `source=user_confirmed`.
 *   new_item       → normalize the label to a canonical (trigram → else create, like §5.4) and
 *     seed pantry via the ledger.
 *   unconfirmed (absence) → NOT written here. Absence ≠ depletion; the review surfaces it as a
 *     question instead of mutating anything.
 */
import { and, eq, inArray } from "drizzle-orm";
import { NORMALIZE } from "@gm/config/constants";
import { pantryScanDetections, pantryScans, pantryStock, type Querier } from "@gm/db";
import { createDbNormalizationPorts } from "../ingestion/db-ports.js";
import { appendLedgerAndReproject } from "../pantry/persist.js";
import type { ReconciledDetection } from "./reconcile.js";
import type { ScanLocation } from "./detect.js";

export interface ApplyScanInput {
  location: ScanLocation;
  model: string | null;
  summary: string;
  detectionConfidence?: number | null;
  /** User-approved confirmations (carry a pantry canonicalItemId). */
  confirmations: ReconciledDetection[];
  /** User-approved additions (canonicalItemId may be null → resolve/create). */
  newItems: ReconciledDetection[];
}

export interface ApplyScanResult {
  scanId: string;
  confirmed: number;
  added: number;
}

export async function applyVisionScan(
  db: Querier,
  userId: string,
  input: ApplyScanInput,
): Promise<ApplyScanResult> {
  const now = new Date();

  const [scan] = await db
    .insert(pantryScans)
    .values({
      userId,
      location: input.location,
      model: input.model ?? null,
      status: "reviewed",
      summary: input.summary,
      detectionConfidence: input.detectionConfidence ?? null,
    })
    .returning({ id: pantryScans.id });
  const scanId = scan!.id;

  // Load current state for confirmation targets once (status/qty/rate drive how we re-ground).
  const confirmIds = input.confirmations
    .map((c) => c.canonicalItemId)
    .filter((id): id is string => Boolean(id));
  const current = confirmIds.length
    ? await db
        .select({
          id: pantryStock.canonicalItemId,
          status: pantryStock.status,
          qty: pantryStock.baseQtyOnHand,
          rate: pantryStock.estimatedConsumptionRatePerDay,
        })
        .from(pantryStock)
        .where(and(eq(pantryStock.userId, userId), inArray(pantryStock.canonicalItemId, confirmIds)))
    : [];
  const curMap = new Map(current.map((r) => [r.id, r]));

  let confirmed = 0;
  for (const c of input.confirmations) {
    if (!c.canonicalItemId) continue;
    const [det] = await db
      .insert(pantryScanDetections)
      .values({
        pantryScanId: scanId,
        canonicalItemId: c.canonicalItemId,
        rawLabel: c.rawLabel,
        presenceConfidence: c.presenceConfidence,
        matchMethod: "trigram",
        action: "confirm_present",
        userConfirmed: true,
      })
      .returning({ id: pantryScanDetections.id });

    const cur = curMap.get(c.canonicalItemId);
    const wasEmpty =
      !cur || cur.status === "out" || cur.status === "expired_likely" || Number(cur.qty) <= 0;
    await appendLedgerAndReproject(db, {
      userId,
      canonicalItemId: c.canonicalItemId,
      baseQtyDelta: wasEmpty ? (c.qtyEstimate ?? 1) : 0,
      eventType: "vision_confirmed",
      confidence: c.presenceConfidence,
      refType: "pantry_scan_detection",
      refId: det!.id,
      occurredAt: now,
      ratePerDay: cur?.rate != null ? Number(cur.rate) : null,
    });
    await db
      .update(pantryStock)
      .set({ lastConfirmedAt: now, source: "user_confirmed" })
      .where(and(eq(pantryStock.userId, userId), eq(pantryStock.canonicalItemId, c.canonicalItemId)));
    confirmed++;
  }

  const ports = createDbNormalizationPorts(db, userId);
  let added = 0;
  for (const n of input.newItems) {
    let canonicalItemId = n.canonicalItemId;
    if (!canonicalItemId) {
      const [top] = await ports.trigramCandidates(n.rawLabel, 1);
      canonicalItemId =
        top && top.score >= NORMALIZE.trigramThreshold ? top.id : await ports.createCanonical(n.rawLabel);
    }
    const [det] = await db
      .insert(pantryScanDetections)
      .values({
        pantryScanId: scanId,
        canonicalItemId,
        rawLabel: n.rawLabel,
        presenceConfidence: n.presenceConfidence,
        matchMethod: n.canonicalItemId ? "manual" : "trigram",
        action: "new_item",
        userConfirmed: true,
      })
      .returning({ id: pantryScanDetections.id });

    await appendLedgerAndReproject(db, {
      userId,
      canonicalItemId,
      baseQtyDelta: n.qtyEstimate ?? 1,
      eventType: "vision_confirmed",
      confidence: n.presenceConfidence,
      refType: "pantry_scan_detection",
      refId: det!.id,
      occurredAt: now,
      ratePerDay: null,
    });
    added++;
  }

  return { scanId, confirmed, added };
}
