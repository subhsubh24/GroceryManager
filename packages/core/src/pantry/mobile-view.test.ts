import { describe, it, expect } from "vitest";
import { toMobilePantryItems, type MobilePantryRow } from "./mobile-view.js";

const NOW = new Date("2026-07-23T12:00:00.000Z");

function row(over: Partial<MobilePantryRow> = {}): MobilePantryRow {
  return {
    canonicalItemId: "c1",
    name: "Whole Milk",
    baseQtyOnHand: 2,
    status: "ok",
    estimatedRunOutAt: null,
    ...over,
  };
}

/** Map one row and return the (guaranteed-present) first DTO. */
function one(over: Partial<MobilePantryRow>) {
  const item = toMobilePantryItems([row(over)], NOW)[0];
  if (!item) throw new Error("expected one mapped item");
  return item;
}

describe("toMobilePantryItems", () => {
  it("maps canonicalItemId → id and exposes name/status/quantity", () => {
    const item = one({ canonicalItemId: "abc", status: "low" });
    expect(item.id).toBe("abc");
    expect(item.name).toBe("Whole Milk");
    expect(item.status).toBe("low");
    expect(item.quantity).toBe(2);
  });

  it("coerces a numeric-string on-hand and rounds to a whole figure", () => {
    expect(one({ baseQtyOnHand: "3.6" }).quantity).toBe(4);
  });

  it("never renders NaN — a bad on-hand coerces to 0", () => {
    expect(one({ baseQtyOnHand: "not-a-number" }).quantity).toBe(0);
  });

  it("derives whole days-until-run-out from estimatedRunOutAt (future → positive, ceil)", () => {
    // 3.5 days out ⇒ ceil to 4
    const runOut = new Date(NOW.getTime() + 3.5 * 86_400_000);
    expect(one({ estimatedRunOutAt: runOut }).runsOutInDays).toBe(4);
  });

  it("returns ≤0 for a past/overdue run-out estimate", () => {
    const runOut = new Date(NOW.getTime() - 2 * 86_400_000);
    expect(one({ estimatedRunOutAt: runOut }).runsOutInDays).toBeLessThanOrEqual(0);
  });

  it("yields null days when there is no run-out estimate (client hides the countdown)", () => {
    expect(one({ estimatedRunOutAt: null }).runsOutInDays).toBeNull();
    expect(one({ estimatedRunOutAt: "garbage" }).runsOutInDays).toBeNull();
  });

  it("accepts an ISO-string run-out (the JSON boundary shape)", () => {
    const iso = new Date(NOW.getTime() + 86_400_000).toISOString();
    expect(one({ estimatedRunOutAt: iso }).runsOutInDays).toBe(1);
  });

  it("maps every row in order", () => {
    const items = toMobilePantryItems([row({ canonicalItemId: "a" }), row({ canonicalItemId: "b" })], NOW);
    expect(items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});
