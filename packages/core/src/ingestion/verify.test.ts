import { describe, expect, it } from "vitest";
import type { ReceiptExtraction, ReceiptLineItem } from "@gm/shared";
import { verifyReceipt } from "./verify.js";

function line(over: Partial<ReceiptLineItem> = {}): ReceiptLineItem {
  return {
    rawText: "MILK 1GAL",
    name: "whole milk",
    brand: null,
    upc: null,
    quantity: 1,
    unitText: "gal",
    packageSize: "1 gal",
    unitPriceCents: 399,
    lineTotalCents: 399,
    confidence: 0.9,
    ...over,
  };
}

function receipt(over: Partial<ReceiptExtraction> = {}): ReceiptExtraction {
  return {
    retailer: "whole_foods",
    externalOrderId: "WF-123",
    purchasedAt: "2026-06-10T17:00:00Z",
    currency: "USD",
    totalCents: 399,
    lineItems: [line()],
    ...over,
  };
}

describe("verifyReceipt", () => {
  it("passes a clean receipt", () => {
    expect(verifyReceipt(receipt())).toEqual({ ok: true });
  });

  it("accepts an item-less email (e.g. Amazon strips items) — empty is valid, not a failure", () => {
    const v = verifyReceipt(receipt({ lineItems: [], totalCents: null }));
    expect(v).toEqual({ ok: true });
  });

  it("fails on a negative quantity", () => {
    const v = verifyReceipt(receipt({ lineItems: [line({ quantity: -1 })] }));
    expect(v).toMatchObject({ ok: false });
  });

  it("fails when line totals EXCEED the grand total (duplicated/hallucinated lines)", () => {
    const v = verifyReceipt(
      receipt({ totalCents: 399, lineItems: [line({ lineTotalCents: 1000 }), line({ lineTotalCents: 1000 })] }),
    );
    expect(v).toMatchObject({ ok: false });
  });

  it("passes when line totals are UNDER the grand total (tax, fees, tips, discounts)", () => {
    // Delivery receipt: items 399¢, grand total 5000¢ (fees + tip) — normal, must not fail.
    const v = verifyReceipt(receipt({ totalCents: 5000, lineItems: [line({ lineTotalCents: 399 })] }));
    expect(v).toEqual({ ok: true });
  });

  it("tolerates small rounding over the total within tolerance", () => {
    const v = verifyReceipt(
      receipt({ totalCents: 399, lineItems: [line({ lineTotalCents: 420 })] }), // 21¢ over < 100¢ floor
    );
    expect(v).toEqual({ ok: true });
  });
});
