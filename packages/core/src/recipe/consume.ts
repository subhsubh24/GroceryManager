/**
 * Cook → pantry consumption (PLAN §7.2). Pure + testable. Given a recipe's ingredients and the
 * current pantry, decide what cooking it consumes.
 *
 * Honesty constraint: TheMealDB has no servings and freeform measures, so we ONLY emit a precise
 * decrement when a measure cleanly parses AND a resolver converts it to the canonical item's base
 * unit (e.g. "200 g", "2" eggs). Everything else is recorded as "used" (qty unknown) — never a
 * fabricated quantity. The caller appends consume_recipe ledger events for the precise deltas and
 * uses the matched set for cuisine learning. Precise where we can; honest where we can't.
 */
import { normalizeIngredientName } from "./match.js";

export interface ConsumeIngredient {
  name: string;
  measure?: string | null;
  isOptional?: boolean;
}

export interface ConsumePantryItem {
  canonicalItemId: string;
  name: string;
  aliases?: string[] | null;
  baseQtyOnHand: number;
}

export interface ConsumeDelta {
  canonicalItemId: string;
  name: string;
  /** Negative base-unit change to append as a consume_recipe ledger event. */
  baseQtyDelta: number;
}

export interface ConsumePlan {
  /** Precise decrements (matched + measurable), clamped to on-hand. */
  deltas: ConsumeDelta[];
  /** Names of matched pantry items whose quantity we couldn't measure (used, qty unknown). */
  usedUnmeasured: string[];
}

/** Resolve a parsed measure to the canonical item's base unit; null when not confidently possible. */
export type BaseQtyResolver = (
  canonicalItemId: string,
  qty: number,
  unit: string | null,
) => number | null;

const STOP = new Set([
  "fresh", "organic", "of", "the", "a", "an", "raw", "whole", "ground", "chopped", "minced",
  "diced", "sliced", "large", "small", "medium", "ripe", "frozen", "dried", "cooked",
]);

function tokenize(s: string): Set<string> {
  return new Set(
    normalizeIngredientName(s)
      .split(" ")
      .map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t))
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

/** Bidirectional containment: "spinach" matches "baby spinach" and vice versa. */
function matches(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (!big.has(t)) return false;
  return true;
}

const UNICODE_FRAC: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

function qtyToken(tok: string): number | null {
  const mixed = tok.match(/^(\d+)\s+(\d+)\/(\d+)$/); // "1 1/2"
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = tok.match(/^(\d+)\/(\d+)$/); // "1/2"
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const num = Number(tok);
  return Number.isFinite(num) ? num : null;
}

/** Parse a TheMealDB measure into a leading quantity + (optional) unit code; null if no quantity. */
export function parseMeasure(measure: string | null | undefined): { qty: number; unit: string | null } | null {
  if (!measure) return null;
  let s = measure.trim().toLowerCase();
  if (!s || /^(to taste|some|as needed|a pinch|pinch|garnish|dash|drizzle|for )/.test(s)) return null;

  // Leading unicode fraction (e.g. "½ cup").
  const uni = UNICODE_FRAC[s[0] ?? ""];
  let qty: number | null = null;
  let rest = s;
  if (uni != null) {
    qty = uni;
    rest = s.slice(1).trim();
  } else {
    const m = s.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/);
    if (!m) return null;
    qty = qtyToken(m[1]!);
    rest = s.slice(m[0]!.length).trim();
  }
  if (qty == null || qty <= 0) return null;

  rest = rest.replace(/^[-–—]\s*(?:\d+\s+)?\d+(?:[\/\.]\d+)?\s*/, ""); // drop the high end of a range ("1-2", "1/2-3/4", "1-1 1/2")
  const unitTok = rest.match(/^([a-z]+)/)?.[1] ?? null;
  const unit = unitTok ? (unitTok.length > 3 && unitTok.endsWith("s") ? unitTok.slice(0, -1) : unitTok) : null;
  return { qty, unit };
}

export function planConsumption(
  ingredients: ConsumeIngredient[],
  pantry: ConsumePantryItem[],
  opts: { servingsScale?: number; resolveBaseQty?: BaseQtyResolver } = {},
): ConsumePlan {
  const scale = opts.servingsScale && opts.servingsScale > 0 ? opts.servingsScale : 1;
  const indexed = pantry.map((p) => ({ item: p, tokens: tokenize([p.name, ...(p.aliases ?? [])].join(" ")) }));

  const deltas: ConsumeDelta[] = [];
  const usedUnmeasured: string[] = [];
  const seen = new Set<string>();

  for (const ing of ingredients) {
    if (ing.isOptional) continue;
    const it = tokenize(ing.name);
    const hit = indexed.find((c) => matches(it, c.tokens));
    if (!hit || seen.has(hit.item.canonicalItemId)) continue;
    seen.add(hit.item.canonicalItemId);

    const parsed = parseMeasure(ing.measure);
    const base = parsed && opts.resolveBaseQty
      ? opts.resolveBaseQty(hit.item.canonicalItemId, parsed.qty * scale, parsed.unit)
      : null;

    if (base != null && base > 0) {
      const consumed = Math.min(base, hit.item.baseQtyOnHand);
      if (consumed > 0) {
        deltas.push({ canonicalItemId: hit.item.canonicalItemId, name: hit.item.name, baseQtyDelta: -consumed });
        continue;
      }
    }
    usedUnmeasured.push(hit.item.name);
  }

  return { deltas, usedUnmeasured };
}
