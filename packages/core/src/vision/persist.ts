/**
 * Persist a reviewed vision scan (PLAN §5.6). Must run inside withTenant — every write is
 * RLS-scoped to the user. Semantics mirror the §5.6 rules exactly:
 *
 *   confirm_present → append a `vision_confirmed` ledger event at `now` (resets the confidence
 *     decay clock, preserving the learned rate; restores an out/expired item to in_stock); the
 *     reprojection stamps `lastConfirmedAt` / `source=user_confirmed` via the ledger path — never a
 *     direct pantry_stock write (the §6 ledger-only invariant).
 *   new_item       → normalize the label to a canonical (trigram → else create, like §5.4) and
 *     seed pantry via the ledger.
 *   unconfirmed (absence) → NOT written here. Absence ≠ depletion; the review surfaces it as a
 *     question instead of mutating anything.
 */
import { and, eq, inArray } from "drizzle-orm";
import { loadEnv } from "@gm/config/env";
import { pantryScanDetections, pantryScans, pantryStock, type Querier } from "@gm/db";
import { createGeminiEmbedder, getGeminiClient } from "../llm/index.js";
import { createDbNormalizationPorts } from "../ingestion/db-ports.js";
import { createLlmNormalizer } from "../ingestion/llm-normalizer.js";
import { normalizeLineItem, type NormalizationResult } from "../ingestion/normalize.js";
import { appendLedgerAndReproject } from "../pantry/persist.js";
import { createLlmShelfLifeEstimator } from "../pantry/shelf-life-llm.js";
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
    // Ledger-only (§6): the `vision_confirmed` event at `now` re-grounds the projection — reproject
    // already derives lastConfirmedAt from it — and `source: "user_confirmed"` stamps the provenance
    // through the same path. No direct pantry_stock write (the invariant the rest of the app relies on).
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
      source: "user_confirmed",
    });
    confirmed++;
  }

  // Full §5.4 normalization cascade (override → upc → trigram → embedding → LLM → create) so a scanned
  // label resolves to an EXISTING canonical instead of spawning a near-duplicate ("baby spinach" →
  // existing "spinach"). Embedding + LLM run only when a Gemini key is configured; otherwise it falls
  // back to trigram-then-create (the prior behavior). Newly created canonicals get shelf-life via the port.
  const env = loadEnv();
  const aiClient = env.GEMINI_API_KEY || env.GOOGLE_VERTEX_PROJECT ? getGeminiClient() : null;
  const ports = createDbNormalizationPorts(
    db,
    userId,
    aiClient
      ? {
          embed: createGeminiEmbedder(aiClient),
          llm: createLlmNormalizer(aiClient),
          shelfLife: createLlmShelfLifeEstimator(aiClient),
        }
      : undefined,
  );
  let added = 0;
  for (const n of input.newItems) {
    let canonicalItemId = n.canonicalItemId;
    let method: NormalizationResult["method"] = "manual";
    if (!canonicalItemId) {
      const norm = await normalizeLineItem({ rawText: n.rawLabel, name: n.rawLabel, upc: null }, ports);
      canonicalItemId = norm.canonicalItemId ?? (await ports.createCanonical(n.rawLabel));
      method = norm.method;
    }
    const [det] = await db
      .insert(pantryScanDetections)
      .values({
        pantryScanId: scanId,
        canonicalItemId,
        rawLabel: n.rawLabel,
        presenceConfidence: n.presenceConfidence,
        matchMethod: method,
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
