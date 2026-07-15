import { describe, expect, it } from "vitest";
import {
  effectiveConsumptionRate,
  predictReorder,
  type ReorderPolicySnapshot,
  type StockSnapshot,
} from "./predict.js";

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

  it("recommends nothing to buy when on-hand already meets the par target", () => {
    // baseQtyOnHand (2000) ≥ targetParQty (2000) → needed 0 → recommendQty 0 (never a false reorder qty).
    const r = predictReorder(stock({ baseQtyOnHand: 2000 }), policy({ targetParQty: 2000, packageQty: 1000 }), { asOf });
    expect(r.recommendQty).toBe(0);
  });

  it("recommends the raw shortfall when no package size is configured", () => {
    // No packageQty → no whole-package rounding; order exactly the shortfall (needed 1750).
    const r = predictReorder(stock({ baseQtyOnHand: 250 }), policy({ targetParQty: 2000, packageQty: null }), { asOf });
    expect(r.recommendQty).toBe(1750);
  });

  it("respects a disabled policy", () => {
    const r = predictReorder(stock({ baseQtyOnHand: 0 }), policy({ enabled: false }), { asOf });
    expect(r.shouldReorder).toBe(false);
  });

  it("uses a declared dosage to predict run-out even with no learned cadence (supplements)", () => {
    // First bottle, no purchase history (rate null) but 2 capsules/day declared.
    // 10 on hand / 2 per day = 5 days → order-by in ~3d (leadTime 2) ≤ horizon 3 → reorder.
    const r = predictReorder(
      stock({ baseQtyOnHand: 10, estimatedConsumptionRatePerDay: null, dosesPerDay: 2 }),
      policy({ reorderPointQty: 0, targetParQty: null, packageQty: 60 }),
      { asOf },
    );
    expect(r.predictedRunOutAt).toEqual(new Date(asOf.getTime() + 5 * 86_400_000));
    expect(r.shouldReorder).toBe(true);
    expect(r.recommendQty).toBeNull(); // no par target → no guessed order quantity
  });
});

describe("effectiveConsumptionRate", () => {
  it("prefers a positive declared dosage over the learned rate", () => {
    expect(effectiveConsumptionRate(100, 2)).toBe(2);
  });
  it("falls back to the learned rate when no dosage is set or it's non-positive", () => {
    expect(effectiveConsumptionRate(100, null)).toBe(100);
    expect(effectiveConsumptionRate(100, 0)).toBe(100);
    expect(effectiveConsumptionRate(null, undefined)).toBeNull();
  });
});
