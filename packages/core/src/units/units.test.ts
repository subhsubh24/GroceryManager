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
});
