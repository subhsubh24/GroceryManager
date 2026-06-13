import { describe, expect, it } from "vitest";
import { defaultReorderPolicy } from "./staples.js";

describe("defaultReorderPolicy", () => {
  it("seeds ~2 weeks of par and a lead-time-aware trigger from the learned rate", () => {
    const p = defaultReorderPolicy({ baseQtyOnHand: 1, ratePerDay: 2 });
    expect(p.targetParQty).toBe(28); // 2/day × 14
    expect(p.reorderPointQty).toBe(10); // 2/day × (2 + 3)
    expect(p.leadTimeDays).toBe(2);
    expect(p.minIntervalDays).toBe(7);
    expect(p.targetParQty).toBeGreaterThan(p.reorderPointQty);
  });

  it("falls back to on-hand when there is no usable rate", () => {
    for (const rate of [null, 0, -1]) {
      const p = defaultReorderPolicy({ baseQtyOnHand: 4, ratePerDay: rate });
      expect(p.targetParQty).toBe(4);
      expect(p.reorderPointQty).toBe(1); // 25% of par
    }
  });

  it("never seeds a zero par even with no stock", () => {
    const p = defaultReorderPolicy({ baseQtyOnHand: 0, ratePerDay: null });
    expect(p.targetParQty).toBe(1);
  });

  it("rounds fractional rates to 3 decimals", () => {
    const p = defaultReorderPolicy({ baseQtyOnHand: 0, ratePerDay: 0.1 });
    expect(p.targetParQty).toBe(1.4); // 0.1 × 14
    expect(p.reorderPointQty).toBe(0.5); // 0.1 × 5
  });
});
