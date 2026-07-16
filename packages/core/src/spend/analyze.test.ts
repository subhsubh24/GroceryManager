import { describe, expect, it } from "vitest";
import {
  budgetVsActual,
  cheaperRetailer,
  spendByPeriod,
  topItemsBySpend,
  unitPriceTrends,
} from "./analyze.js";

const d = (s: string) => new Date(s + "T12:00:00Z");

describe("spendByPeriod", () => {
  it("groups by month, newest first, skipping null totals", () => {
    const out = spendByPeriod(
      [
        { purchasedAt: d("2026-06-02"), totalCents: 1000 },
        { purchasedAt: d("2026-06-20"), totalCents: 500 },
        { purchasedAt: d("2026-05-10"), totalCents: 700 },
        { purchasedAt: d("2026-06-25"), totalCents: null },
      ],
      "month",
    );
    expect(out[0]).toEqual({ periodStart: "2026-06-01", totalCents: 1500 });
    expect(out[1]).toEqual({ periodStart: "2026-05-01", totalCents: 700 });
  });

  it("groups by ISO week (Monday start), folding Sunday into the prior Monday", () => {
    // 2026-06-01 is a Monday. Sun 2026-06-14 must fold back to the Mon 2026-06-08 week,
    // which is exactly the case the (getUTCDay()+6)%7 offset exists to get right.
    const out = spendByPeriod(
      [
        { purchasedAt: d("2026-06-03"), totalCents: 1000 }, // Wed → week of 06-01
        { purchasedAt: d("2026-06-05"), totalCents: 500 }, // Fri → week of 06-01
        { purchasedAt: d("2026-06-08"), totalCents: 700 }, // Mon → week of 06-08
        { purchasedAt: d("2026-06-14"), totalCents: 300 }, // Sun → still week of 06-08
        { purchasedAt: d("2026-06-10"), totalCents: null }, // skipped
      ],
      "week",
    );
    expect(out[0]).toEqual({ periodStart: "2026-06-08", totalCents: 1000 });
    expect(out[1]).toEqual({ periodStart: "2026-06-01", totalCents: 1500 });
  });
});

describe("topItemsBySpend", () => {
  it("sums per item and ranks, skipping rows with a null line total", () => {
    const out = topItemsBySpend([
      { canonicalItemId: "milk", name: "whole milk", lineTotalCents: 300 },
      { canonicalItemId: "milk", name: "whole milk", lineTotalCents: 350 },
      { canonicalItemId: "eggs", name: "large egg", lineTotalCents: 500 },
      // A receipt line whose total didn't parse — must be dropped, not summed as NaN/0.
      { canonicalItemId: "butter", name: "butter", lineTotalCents: null },
    ]);
    expect(out).toHaveLength(2); // butter excluded entirely
    expect(out[0]).toEqual({ canonicalItemId: "milk", name: "whole milk", totalCents: 650 });
    expect(out[1]!.canonicalItemId).toBe("eggs");
    expect(out.some((i) => i.canonicalItemId === "butter")).toBe(false);
  });
});

describe("cheaperRetailer", () => {
  it("finds the cheapest retailer + savings for items bought at ≥2 retailers", () => {
    const out = cheaperRetailer([
      { canonicalItemId: "milk", name: "whole milk", retailer: "whole_foods", unitPriceCents: 449 },
      { canonicalItemId: "milk", name: "whole milk", retailer: "instacart", unitPriceCents: 399 },
      { canonicalItemId: "eggs", name: "large egg", retailer: "whole_foods", unitPriceCents: 599 }, // only one retailer → excluded
      // A milk row with no unit price — must be skipped, not counted as a (free) third retailer.
      { canonicalItemId: "milk", name: "whole milk", retailer: "aldi", unitPriceCents: null },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ canonicalItemId: "milk", bestRetailer: "instacart", bestCents: 399, savingsVsWorstCents: 50 });
  });
});

describe("unitPriceTrends", () => {
  it("computes latest/avg/min/max chronologically, ignoring null-priced points", () => {
    const out = unitPriceTrends([
      { canonicalItemId: "milk", name: "whole milk", unitPriceCents: 400, purchasedAt: d("2026-06-01") },
      { canonicalItemId: "milk", name: "whole milk", unitPriceCents: 300, purchasedAt: d("2026-06-15") },
      // A later purchase with no unit price must not skew latest/avg (would otherwise read as 0/NaN).
      { canonicalItemId: "milk", name: "whole milk", unitPriceCents: null, purchasedAt: d("2026-06-20") },
    ]);
    expect(out[0]).toMatchObject({ latestCents: 300, avgCents: 350, minCents: 300, maxCents: 400 });
  });
});

describe("budgetVsActual", () => {
  it("flags over/under budget", () => {
    expect(budgetVsActual(5000, 4000)).toMatchObject({ deltaCents: 1000, overBudget: true });
    expect(budgetVsActual(3000, 4000)).toMatchObject({ deltaCents: -1000, overBudget: false });
    expect(budgetVsActual(3000, null)).toMatchObject({ budgetCents: null, overBudget: false });
  });
});
