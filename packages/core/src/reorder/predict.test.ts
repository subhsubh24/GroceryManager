import { describe, expect, it } from "vitest";
import { predictReorder, type ReorderPolicySnapshot, type StockSnapshot } from "./predict.js";

const asOf = new Date(2026, 0, 10);

const policy = (over: Partial<ReorderPolicySnapshot> = {}): ReorderPolicySnapshot => ({
  enabled: true,
  targetParQty: 2000,
  reorderPointQty: 300,
  leadTimeDays: 2,
  minIntervalDays: 7,
  packageQty: 1000,
  ...over,
});

const stock = (over: Partial<StockSnapshot> = {}): StockSnapshot => ({
  baseQtyOnHand: 1000,
  estimatedConsumptionRatePerDay: 100,
  confidence: 0.8,
  ...over,
});

describe("predictReorder", () => {
  it("triggers when on-hand is at/under the reorder point", () => {
    const r = predictReorder(stock({ baseQtyOnHand: 250 }), policy(), { asOf });
    expect(r.shouldReorder).toBe(true);
    expect(r.rationale).toMatch(/reorder point/);
  });

  it("triggers when the order-by date is within the horizon", () => {
    // onHand 250, rate 100 → run-out in 2.5d; leadTime 2 → order-by ~0.5d ≤ horizon 3
    const r = predictReorder(stock({ baseQtyOnHand: 250, estimatedConsumptionRatePerDay: 100 }), policy({ reorderPointQty: 0 }), { asOf });
    expect(r.shouldReorder).toBe(true);
    expect(r.predictedRunOutAt).not.toBeNull();
  });

  it("does not trigger with plenty of stock", () => {
    const r = predictReorder(stock({ baseQtyOnHand: 1800 }), policy(), { asOf });
    expect(r.shouldReorder).toBe(false);
  });

  it("suppresses when suggested within the min interval", () => {
    const r = predictReorder(
      stock({ baseQtyOnHand: 100 }),
      policy({ lastSuggestedAt: new Date(2026, 0, 8) }), // 2 days ago < 7
      { asOf },
    );
    expect(r.shouldReorder).toBe(false);
    expect(r.rationale).toMatch(/min interval/);
  });

  it("rounds the recommended quantity up to whole packages", () => {
    const r = predictReorder(stock({ baseQtyOnHand: 250 }), policy({ targetParQty: 2000, packageQty: 1000 }), { asOf });
    expect(r.recommendQty).toBe(2000); // needed 1750 → ceil to 2×1000
  });

  it("respects a disabled policy", () => {
    const r = predictReorder(stock({ baseQtyOnHand: 0 }), policy({ enabled: false }), { asOf });
    expect(r.shouldReorder).toBe(false);
  });
});
