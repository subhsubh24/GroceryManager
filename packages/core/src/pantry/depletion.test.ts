import { describe, expect, it } from "vitest";
import { decayConfidence, estimateOnHand, ewmaConsumptionRate, type LedgerDelta } from "./depletion.js";

const day = (n: number) => new Date(2026, 0, 1 + n);

describe("estimateOnHand", () => {
  const purchase: LedgerDelta[] = [{ baseQtyDelta: 1000, occurredAt: day(0) }]; // 1000 ml milk

  it("on the purchase day, on-hand equals purchased qty and confidence is high", () => {
    const r = estimateOnHand({ events: purchase, asOf: day(0), ratePerDay: 100 });
    expect(r.baseQtyOnHand).toBe(1000);
    expect(r.status).toBe("in_stock");
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it("decays linearly at the consumption rate", () => {
    const r = estimateOnHand({ events: purchase, asOf: day(3), ratePerDay: 100 });
    expect(r.baseQtyOnHand).toBeCloseTo(700, 6); // 1000 − 3·100
    expect(r.inferredConsumed).toBeCloseTo(300, 6);
  });

  it("flags low at/under the reorder point and out at zero", () => {
    expect(estimateOnHand({ events: purchase, asOf: day(9), ratePerDay: 100, reorderPointQty: 150 }).status).toBe("low");
    expect(estimateOnHand({ events: purchase, asOf: day(20), ratePerDay: 100 }).status).toBe("out");
    expect(estimateOnHand({ events: purchase, asOf: day(20), ratePerDay: 100 }).baseQtyOnHand).toBe(0);
  });

  it("applies the shelf-life ceiling for perishables once WELL past shelf life (+ grace)", () => {
    const r = estimateOnHand({
      events: [{ baseQtyDelta: 200, occurredAt: day(0) }], // spinach, shelf life 7
      asOf: day(30), // 30 > 7 + 14 grace → confidently expired
      ratePerDay: null,
      perishable: true,
      shelfLifeDays: 7,
      lastPurchaseAt: day(0),
    });
    expect(r.status).toBe("expired_likely");
    expect(r.baseQtyOnHand).toBe(0);
  });

  it("does NOT auto-expire inside the grace window — stays in stock, flags as expiring", () => {
    const r = estimateOnHand({
      events: [{ baseQtyDelta: 200, occurredAt: day(0) }], // shelf life 7
      asOf: day(12), // past shelf life (7) but within grace (7+14) → review, don't assume
      ratePerDay: null,
      perishable: true,
      shelfLifeDays: 7,
      lastPurchaseAt: day(0),
    });
    expect(r.status).toBe("in_stock"); // not assumed dead
    expect(r.baseQtyOnHand).toBe(200);
    // …but its run-out is the (now-passed) spoil date, so "use it up" surfaces it.
    expect(r.estimatedRunOutAt).not.toBeNull();
    expect(r.estimatedRunOutAt!.getTime()).toBe(day(7).getTime());
  });

  it("a confirmation re-grounds the spoilage clock (still have it) without faking the purchase date", () => {
    // Bought spinach day 0 (shelf life 7), then confirmed present on day 18 — on day 21 it's NOT expired
    // because freshness runs from the later confirmation, even though lastPurchaseAt stays day 0.
    const r = estimateOnHand({
      events: [
        { baseQtyDelta: 200, occurredAt: day(0) },
        { baseQtyDelta: 0, occurredAt: day(18) }, // "still have it"
      ],
      asOf: day(21),
      ratePerDay: null,
      perishable: true,
      shelfLifeDays: 7,
      lastPurchaseAt: day(0),
      lastConfirmedAt: day(18),
    });
    expect(r.status).toBe("in_stock");
    expect(r.baseQtyOnHand).toBe(200);
  });

  it("a STALE confirmation doesn't save an item well past shelf life from when it was last confirmed", () => {
    const r = estimateOnHand({
      events: [{ baseQtyDelta: 200, occurredAt: day(0) }],
      asOf: day(30),
      ratePerDay: null,
      perishable: true,
      shelfLifeDays: 7,
      lastPurchaseAt: day(0),
      lastConfirmedAt: day(2), // confirmed day 2 → 28 days later is well past shelf life + grace
    });
    expect(r.status).toBe("expired_likely");
  });

  it("predicts a run-out date from the rate", () => {
    const r = estimateOnHand({ events: purchase, asOf: day(1), ratePerDay: 100 });
    expect(r.estimatedRunOutAt).not.toBeNull();
    // 1000 / 100 = 10 days after the purchase (day 0)
    expect(r.estimatedRunOutAt!.getTime()).toBe(day(10).getTime());
  });

  it("zero-delta confirmation does not skip consumption between purchase and confirm", () => {
    const r = estimateOnHand({
      events: [
        { baseQtyDelta: 1000, occurredAt: day(0) },
        { baseQtyDelta: 0, occurredAt: day(5) }, // "still have it" — should NOT reset depletion clock
      ],
      asOf: day(6),
      ratePerDay: 100,
    });
    // Should be 1000 - 100*6 = 400, NOT 1000 - 100*1 = 900
    expect(r.baseQtyOnHand).toBeCloseTo(400, 6);
  });
});

describe("ewmaConsumptionRate", () => {
  it("returns null with insufficient history", () => {
    expect(ewmaConsumptionRate([{ qty: 12, at: day(0) }])).toBeNull();
  });

  it("derives ~1 unit/day from a dozen eggs bought every 12 days", () => {
    const rate = ewmaConsumptionRate([
      { qty: 12, at: day(0) },
      { qty: 12, at: day(12) },
      { qty: 12, at: day(24) },
    ]);
    expect(rate).toBeCloseTo(1, 6);
  });

  it("returns a rate even when one pair of purchases has identical timestamps", () => {
    // Two purchases on day 0, then one on day 10 — EWMA should be non-null
    const rate = ewmaConsumptionRate([
      { qty: 500, at: day(0) },
      { qty: 500, at: day(0) }, // same timestamp, same day
      { qty: 1000, at: day(10) },
    ]);
    // The day0-to-day0 pair is skipped (days=0), but day0-to-day10 = 50/day should still fire
    expect(rate).not.toBeNull();
    expect(rate).toBeGreaterThan(0);
  });

  it("derives the rate from a single interval when exactly 2 purchases exist", () => {
    const rate = ewmaConsumptionRate([
      { qty: 200, at: day(0) },
      { qty: 200, at: day(20) },
    ]);
    expect(rate).toBeCloseTo(10, 6); // 200 / 20 days = 10 units/day
  });
});

describe("decayConfidence", () => {
  it("decays monotonically with elapsed time", () => {
    const c0 = decayConfidence(0.85, 0, 30);
    const c10 = decayConfidence(0.85, 10, 30);
    const c40 = decayConfidence(0.85, 40, 30);
    expect(c0).toBeGreaterThan(c10);
    expect(c10).toBeGreaterThan(c40);
    expect(c40).toBeGreaterThanOrEqual(0.1); // clamped floor
  });
});
