/**
 * Vision-scan reconciliation (PLAN §5.6) — the careful, pure heart of the pantry scan.
 *
 * Receipts say what *entered*; a photo says what's *actually there now*. This reconciles a
 * detection list against current PantryStock with one inviolable rule: **presence is a strong
 * signal, absence is weak.** An item we can see is confirmed (refresh confidence); an item we
 * can't see is NEVER zeroed or marked out — it's only flagged unconfirmed with a mildly lowered
 * confidence, because it may be behind something, in an opaque jar, or in the freezer. The app
 * confirms; it does not assume. Pure + exhaustively testable.
 */

export interface ScanDetectionInput {
  rawLabel: string;
  /** Set when the detector/normalizer already resolved a catalog item. */
  canonicalItemId?: string | null;
  presenceConfidence: number; // 0..1
  qtyEstimate?: number | null;
  qtyConfidence?: number | null;
}

export interface ReconcilePantryItem {
  canonicalItemId: string;
  name: string;
  aliases?: string[] | null;
  status: string; // stock_status
  confidence: number; // current
}

export type ReconcileAction = "confirm_present" | "new_item";

export interface ReconciledDetection {
  rawLabel: string;
  action: ReconcileAction;
  /** Matched pantry item (confirm) or a known-catalog id for a new item, else null. */
  canonicalItemId: string | null;
  matchedName: string | null;
  presenceConfidence: number;
  qtyEstimate: number | null;
  /** Proposed pantry confidence after confirming (null for new items). */
  newConfidence: number | null;
}

export interface UnconfirmedItem {
  canonicalItemId: string;
  name: string;
  prevConfidence: number;
  /** Mildly lowered — NEVER zeroed; status is left untouched (absence ≠ depletion). */
  proposedConfidence: number;
}

export interface ReconciliationResult {
  confirmations: ReconciledDetection[];
  newItems: ReconciledDetection[];
  unconfirmed: UnconfirmedItem[];
  summary: string;
}

export interface ReconcileOpts {
  /** Drop detections below this presence confidence as noise. */
  minPresence?: number;
  /** How much a confirmation boosts confidence (scaled by presence). */
  confirmBoost?: number;
  /** Multiplicative confidence decay applied to an in-stock item we didn't see. */
  unseenDecay?: number;
  /** Floor the unseen decay never drops below. */
  unseenFloor?: number;
}

const DEFAULTS: Required<ReconcileOpts> = {
  minPresence: 0.4,
  confirmBoost: 0.3,
  unseenDecay: 0.85,
  unseenFloor: 0.3,
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const STOP = new Set([
  "fresh", "organic", "of", "the", "a", "an", "raw", "whole", "low", "fat", "reduced", "pack",
  "bottle", "jar", "can", "bag", "box", "container", "carton",
]);

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t))
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

/** Bidirectional subset: "spinach" matches "baby spinach" and vice versa. */
function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let hit = 0;
  for (const t of small) if (big.has(t)) hit++;
  return hit === small.size ? hit : 0; // require the smaller set fully contained
}

export function reconcileScan(
  detections: ScanDetectionInput[],
  pantry: ReconcilePantryItem[],
  opts: ReconcileOpts = {},
): ReconciliationResult {
  const o = { ...DEFAULTS, ...opts };
  const byId = new Map(pantry.map((p) => [p.canonicalItemId, p]));
  const indexed = pantry.map((p) => ({
    item: p,
    tokens: tokenize([p.name, ...(p.aliases ?? [])].join(" ")),
  }));

  const confirmedById = new Map<string, ReconciledDetection>();
  const newByKey = new Map<string, ReconciledDetection>();

  for (const d of detections) {
    if (d.presenceConfidence < o.minPresence) continue;

    // Resolve to a pantry item: explicit id first, then best token overlap.
    let matched: ReconcilePantryItem | null =
      d.canonicalItemId && byId.has(d.canonicalItemId) ? byId.get(d.canonicalItemId)! : null;
    if (!matched) {
      const dt = tokenize(d.rawLabel);
      let best = 0;
      for (const cand of indexed) {
        const score = overlap(dt, cand.tokens);
        if (score > best) {
          best = score;
          matched = cand.item;
        }
      }
    }

    if (matched) {
      const newConfidence = clamp01(Math.max(matched.confidence, 0.6) + o.confirmBoost * d.presenceConfidence);
      const prev = confirmedById.get(matched.canonicalItemId);
      if (!prev || d.presenceConfidence > prev.presenceConfidence) {
        confirmedById.set(matched.canonicalItemId, {
          rawLabel: d.rawLabel,
          action: "confirm_present",
          canonicalItemId: matched.canonicalItemId,
          matchedName: matched.name,
          presenceConfidence: d.presenceConfidence,
          qtyEstimate: d.qtyEstimate ?? null,
          newConfidence,
        });
      }
    } else {
      const key = [...tokenize(d.rawLabel)].sort().join(" ") || d.rawLabel.toLowerCase().trim();
      const prev = newByKey.get(key);
      if (!prev || d.presenceConfidence > prev.presenceConfidence) {
        newByKey.set(key, {
          rawLabel: d.rawLabel,
          action: "new_item",
          canonicalItemId: d.canonicalItemId ?? null,
          matchedName: null,
          presenceConfidence: d.presenceConfidence,
          qtyEstimate: d.qtyEstimate ?? null,
          newConfidence: null,
        });
      }
    }
  }

  // Absence ≠ depletion: in-stock items we didn't see are flagged, never zeroed.
  const confirmedIds = new Set(confirmedById.keys());
  const unconfirmed: UnconfirmedItem[] = pantry
    .filter((p) => (p.status === "in_stock" || p.status === "low") && !confirmedIds.has(p.canonicalItemId))
    .map((p) => ({
      canonicalItemId: p.canonicalItemId,
      name: p.name,
      prevConfidence: p.confidence,
      proposedConfidence: Math.max(p.confidence * o.unseenDecay, o.unseenFloor),
    }));

  const confirmations = [...confirmedById.values()];
  const newItems = [...newByKey.values()];
  const summary =
    `Saw ${confirmations.length + newItems.length} item(s): ${confirmations.length} already tracked, ` +
    `${newItems.length} new.` +
    (unconfirmed.length ? ` ${unconfirmed.length} tracked item(s) weren't visible — still counted.` : "");

  return { confirmations, newItems, unconfirmed, summary };
}
