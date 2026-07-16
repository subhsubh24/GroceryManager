import { describe, expect, it } from "vitest";
import { UnitConverter, type UnitDef, type ItemConversion } from "./index.js";

const UNITS: UnitDef[] = [
  { code: "g", dimension: "MASS", toBaseFactor: 1 },
  { code: "kg", dimension: "MASS", toBaseFactor: 1000 },
  { code: "oz", dimension: "MASS", toBaseFactor: 28.3495 },
  { code: "lb", dimension: "MASS", toBaseFactor: 453.592 },
  { code: "ml", dimension: "VOLUME", toBaseFactor: 1 },
  { code: "l", dimension: "VOLUME", toBaseFactor: 1000 },
  { code: "cup", dimension: "VOLUME", toBaseFactor: 236.588 },
  { code: "each", dimension: "COUNT", toBaseFactor: 1 },
  { code: "clove", dimension: "DISCRETE", toBaseFactor: null },
];

const conv = new UnitConverter(UNITS);

describe("UnitConverter", () => {
  it("identity is exact", () => {
    expect(conv.convert(5, "g", "g")).toEqual({ qty: 5, confidence: 1, method: "identity" });
  });

  it("global same-dimension is exact", () => {
    const r = conv.convert(2, "kg", "g");
    expect(r).not.toBeNull();
    expect(r!.qty).toBeCloseTo(2000, 6);
    expect(r!.confidence).toBe(1);
    expect(r!.method).toBe("global");
  });

  it("lb → g", () => {
    expect(conv.convert(1, "lb", "g")!.qty).toBeCloseTo(453.592, 3);
  });

  it("cup → ml", () => {
    expect(conv.convert(1, "cup", "ml")!.qty).toBeCloseTo(236.588, 3);
  });

  it("uses item-specific conversion (clove → g) at the conversion's confidence", () => {
    const itemConv: ItemConversion[] = [{ fromCode: "clove", toCode: "g", factor: 5, confidence: 0.9 }];
    const r = conv.convert(3, "clove", "g", itemConv);
    expect(r).toEqual({ qty: 15, confidence: 0.9, method: "item" });
  });

  it("reverses an item conversion (g → clove)", () => {
    const itemConv: ItemConversion[] = [{ fromCode: "clove", toCode: "g", factor: 5, confidence: 0.9 }];
    const r = conv.convert(15, "g", "clove", itemConv);
    expect(r!.qty).toBeCloseTo(3, 6);
    expect(r!.method).toBe("item");
  });

  it("falls back to water-density across volume↔mass with low confidence", () => {
    const r = conv.convert(1, "l", "g"); // 1000 ml ≈ 1000 g
    expect(r!.qty).toBeCloseTo(1000, 6);
    expect(r!.confidence).toBeLessThan(0.5);
    expect(r!.method).toBe("heuristic");
  });

  it("returns null for COUNT↔MASS with no item data", () => {
    expect(conv.convert(2, "each", "g")).toBeNull();
  });

  it("returns null when an item edge exists but no path reaches the target", () => {
    // A clove↔g edge exists, so the BFS start set is non-empty (unlike the COUNT↔MASS case above,
    // which has no start edge at all), but neither the direct hop nor any 2-hop chain reaches
    // "each" — the converter must exhaust the search and fall through to null so logCook's caller
    // can degrade instead of inventing a bogus quantity.
    const itemConv: ItemConversion[] = [{ fromCode: "clove", toCode: "g", factor: 5, confidence: 0.9 }];
    expect(conv.convert(3, "clove", "each", itemConv)).toBeNull();
  });

  it("chains two item conversions (each → g via clove) as item_base", () => {
    // No direct each↔g edge, so the converter must walk each → clove → g (a 2-hop BFS).
    const itemConv: ItemConversion[] = [
      { fromCode: "each", toCode: "clove", factor: 10, confidence: 0.8 }, // 1 head = 10 cloves
      { fromCode: "clove", toCode: "g", factor: 5, confidence: 0.9 }, //     1 clove = 5 g
    ];
    const r = conv.convert(2, "each", "g", itemConv);
    expect(r).not.toBeNull();
    expect(r!.qty).toBeCloseTo(100, 6); // 2 × 10 × 5
    expect(r!.method).toBe("item_base");
    // Confidence propagates as the MINIMUM of the hops, not the last one.
    expect(r!.confidence).toBe(0.8);
  });

  it("chains item conversions through REVERSED edges (g → each)", () => {
    // The reverse direction must also chain: g → clove (1/5) → each (1/10).
    const itemConv: ItemConversion[] = [
      { fromCode: "each", toCode: "clove", factor: 10, confidence: 0.8 },
      { fromCode: "clove", toCode: "g", factor: 5, confidence: 0.7 },
    ];
    const r = conv.convert(100, "g", "each", itemConv);
    expect(r).not.toBeNull();
    expect(r!.qty).toBeCloseTo(2, 6); // 100 × (1/5) × (1/10)
    expect(r!.method).toBe("item_base");
    expect(r!.confidence).toBe(0.7); // min(0.7, 0.8)
  });

  it("prefers a DIRECT item edge over a 2-hop chain (item beats item_base)", () => {
    // Both a direct clove→g and an indirect clove→each→g path exist; the direct one wins.
    const itemConv: ItemConversion[] = [
      { fromCode: "clove", toCode: "g", factor: 5, confidence: 0.9 },
      { fromCode: "clove", toCode: "each", factor: 0.1, confidence: 0.6 },
      { fromCode: "each", toCode: "g", factor: 50, confidence: 0.6 },
    ];
    const r = conv.convert(3, "clove", "g", itemConv);
    expect(r!.method).toBe("item");
    expect(r!.qty).toBeCloseTo(15, 6); // 3 × 5 (direct), not via each
    expect(r!.confidence).toBe(0.9);
  });

  it("exposes unit definitions via unit()", () => {
    expect(conv.unit("g")).toEqual({ code: "g", dimension: "MASS", toBaseFactor: 1 });
    expect(conv.unit("nope")).toBeUndefined();
  });
});
