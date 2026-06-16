import { describe, expect, it } from "vitest";
import { summarizeWaste, type WasteEvent } from "./waste.js";

const ev = (canonicalItemId: string, name: string, estCents?: number | null): WasteEvent => ({
  canonicalItemId,
  name,
  baseQtyDelta: -1,
  occurredAt: new Date("2026-06-01"),
  estCents,
});

describe("summarizeWaste", () => {
  it("counts events and groups by item, most-tossed first", () => {
    const s = summarizeWaste([ev("c-spin", "spinach"), ev("c-milk", "milk"), ev("c-spin", "spinach")]);
    expect(s.count).toBe(3);
    expect(s.byItem[0]).toMatchObject({ canonicalItemId: "c-spin", name: "spinach", count: 2 });
    expect(s.byItem[1]!.name).toBe("milk");
  });

  it("sums cost only when estimates are supplied (no fake precision)", () => {
    const withCost = summarizeWaste([ev("c-spin", "spinach", 300), ev("c-spin", "spinach", 250)]);
    expect(withCost.hasCostData).toBe(true);
    expect(withCost.totalWastedCents).toBe(550);
    expect(withCost.byItem[0]!.wastedCents).toBe(550);

    const noCost = summarizeWaste([ev("c-milk", "milk"), ev("c-eggs", "eggs")]);
    expect(noCost.hasCostData).toBe(false);
    expect(noCost.totalWastedCents).toBe(0);
  });

  it("is empty-safe", () => {
    expect(summarizeWaste([])).toEqual({ count: 0, totalWastedCents: 0, hasCostData: false, byItem: [] });
  });
});
