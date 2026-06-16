/**
 * Units / quantity conversion service — the crux of the data model (PLAN §4.1).
 *
 * Converts between retail units ("2 lb"), cooking units ("1 cup"), and the canonical
 * base unit, returning a {qty, confidence} so uncertainty propagates into pantry math.
 *
 * Resolution order (first hit wins):
 *   1. identity          — same unit                      (confidence 1.0)
 *   2. global            — same dimension, global factors (confidence 1.0)
 *   3. item / item_base  — item-specific conversion(s)    (confidence from the conversion)
 *   4. heuristic         — cross-dimension fallback (water-like density) (confidence ~0.3)
 *
 * Pure + dependency-free so it's exhaustively testable; a DB loader builds the inputs.
 */
export type Dimension = "MASS" | "VOLUME" | "COUNT" | "DISCRETE";

export interface UnitDef {
  code: string;
  dimension: Dimension;
  /** Factor to the dimension's base unit (g for MASS, ml for VOLUME, each for COUNT). */
  toBaseFactor: number | null;
}

export interface ItemConversion {
  fromCode: string;
  toCode: string;
  factor: number; // qty(from) * factor = qty(to)
  confidence: number;
}

export type ConvertMethod = "identity" | "global" | "item" | "item_base" | "heuristic";

export interface ConvertResult {
  qty: number;
  confidence: number;
  method: ConvertMethod;
}

/** Confidence used for the cross-dimension (volume↔mass) water-density fallback. */
const HEURISTIC_CONFIDENCE = 0.3;

export class UnitConverter {
  private readonly units: Map<string, UnitDef>;

  constructor(units: Iterable<UnitDef>) {
    this.units = new Map();
    for (const u of units) this.units.set(u.code, u);
  }

  unit(code: string): UnitDef | undefined {
    return this.units.get(code);
  }

  /**
   * Convert `qty` from `fromCode` to `toCode`. `itemConversions` are the per-item
   * cross-dimension conversions (density, count↔mass, packs) for the relevant canonical item.
   * Returns null when no path exists (e.g. COUNT↔MASS with no item data).
   */
  convert(
    qty: number,
    fromCode: string,
    toCode: string,
    itemConversions: ItemConversion[] = [],
  ): ConvertResult | null {
    if (fromCode === toCode) return { qty, confidence: 1, method: "identity" };

    const from = this.units.get(fromCode);
    const to = this.units.get(toCode);
    if (!from || !to) return null;

    // 2. Global, same-dimension exact conversion.
    if (
      from.dimension === to.dimension &&
      from.toBaseFactor != null &&
      to.toBaseFactor != null
    ) {
      return {
        qty: (qty * from.toBaseFactor) / to.toBaseFactor,
        confidence: 1,
        method: "global",
      };
    }

    // 3. Item-specific conversion: direct, reverse, or one intermediate hop.
    const item = this.viaItemConversions(qty, fromCode, toCode, itemConversions);
    if (item) return item;

    // 4. Heuristic cross-dimension fallback (volume↔mass), assuming ~1 g/ml.
    const heuristic = this.viaWaterDensity(qty, from, to);
    if (heuristic) return heuristic;

    return null;
  }

  private viaItemConversions(
    qty: number,
    fromCode: string,
    toCode: string,
    conversions: ItemConversion[],
  ): ConvertResult | null {
    // Build a directed graph with both directions (reverse = 1/factor).
    const edges = new Map<string, { to: string; factor: number; confidence: number }[]>();
    const addEdge = (a: string, b: string, factor: number, confidence: number) => {
      const list = edges.get(a) ?? [];
      list.push({ to: b, factor, confidence });
      edges.set(a, list);
    };
    for (const c of conversions) {
      if (c.factor === 0) continue;
      addEdge(c.fromCode, c.toCode, c.factor, c.confidence);
      addEdge(c.toCode, c.fromCode, 1 / c.factor, c.confidence);
    }

    // BFS up to 2 hops (direct = "item", multi-hop = "item_base").
    const start = edges.get(fromCode);
    if (!start) return null;
    for (const e1 of start) {
      if (e1.to === toCode) {
        return { qty: qty * e1.factor, confidence: e1.confidence, method: "item" };
      }
    }
    for (const e1 of start) {
      const next = edges.get(e1.to);
      if (!next) continue;
      for (const e2 of next) {
        if (e2.to === toCode) {
          return {
            qty: qty * e1.factor * e2.factor,
            confidence: Math.min(e1.confidence, e2.confidence),
            method: "item_base",
          };
        }
      }
    }
    return null;
  }

  private viaWaterDensity(qty: number, from: UnitDef, to: UnitDef): ConvertResult | null {
    const isVM =
      (from.dimension === "VOLUME" && to.dimension === "MASS") ||
      (from.dimension === "MASS" && to.dimension === "VOLUME");
    if (!isVM || from.toBaseFactor == null || to.toBaseFactor == null) return null;
    // Convert from → base (ml or g), treat 1 ml ≈ 1 g, then base → to.
    const inFromBase = qty * from.toBaseFactor;
    const inToBase = inFromBase; // density ≈ 1
    return {
      qty: inToBase / to.toBaseFactor,
      confidence: HEURISTIC_CONFIDENCE,
      method: "heuristic",
    };
  }
}
