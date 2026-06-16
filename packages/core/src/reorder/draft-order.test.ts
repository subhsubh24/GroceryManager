import { describe, expect, it } from "vitest";
import { buildDraftOrders, type ReorderInputRow } from "./draft-order.js";

function row(over: Partial<ReorderInputRow>): ReorderInputRow {
  return {
    canonicalItemId: "x",
    name: "item",
    domain: "grocery",
    unit: null,
    baseQtyOnHand: 1000,
    ratePerDay: null,
    confidence: 0.8,
    status: "in_stock",
    enabled: null,
    targetParQty: null,
    reorderPointQty: null,
    leadTimeDays: null,
    minIntervalDays: null,
    lastSuggestedAt: null,
    packageQty: null,
    asin: null,
    ...over,
  };
}

describe("buildDraftOrders", () => {
  it("routes low/out items to the right channel and builds working links", () => {
    const draft = buildDraftOrders(
      [
        row({ canonicalItemId: "milk", name: "whole milk", domain: "grocery", status: "low" }),
        row({ canonicalItemId: "soap", name: "dish soap", domain: "household", status: "out", asin: "B100" }),
        row({ canonicalItemId: "rice", name: "white rice", domain: "grocery", status: "in_stock" }),
      ],
      { associateTag: "gm-20" },
    );

    expect(draft.instacart.items.map((i) => i.name)).toEqual(["whole milk"]); // rice excluded (in stock)
    expect(draft.instacart.payload?.line_items[0]?.name).toBe("whole milk");

    expect(draft.amazon.items.map((i) => i.name)).toEqual(["dish soap"]);
    expect(draft.amazon.addToCartUrl).toContain("ASIN.1=B100");
    expect(draft.amazon.addToCartUrl).toContain("AssociateTag=gm-20");
    expect(draft.amazon.subscribeSave[0]?.url).toContain("/subscribe-and-save/B100");
  });

  it("returns empty channels when nothing is due", () => {
    const draft = buildDraftOrders([row({ status: "in_stock" })]);
    expect(draft.instacart.payload).toBeNull();
    expect(draft.amazon.addToCartUrl).toBeNull();
  });
});
