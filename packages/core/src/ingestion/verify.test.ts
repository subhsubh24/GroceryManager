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

  it("fails when there are no line items", () => {
    const v = verifyReceipt(receipt({ lineItems: [], totalCents: null }));
    expect(v.ok).toBe(false);
  });

  it("fails on a negative quantity", () => {
    const v = verifyReceipt(receipt({ lineItems: [line({ quantity: -1 })] }));
    expect(v).toMatchObject({ ok: false });
  });

  it("fails when line totals don't reconcile with the grand total", () => {
    const v = verifyReceipt(
      receipt({ totalCents: 5000, lineItems: [line({ lineTotalCents: 399 })] }),
    );
    expect(v).toMatchObject({ ok: false });
  });

  it("tolerates small rounding (tax/fees) within tolerance", () => {
    const v = verifyReceipt(
      receipt({ totalCents: 420, lineItems: [line({ lineTotalCents: 399 })] }), // 21¢ < 100¢ floor
    );
    expect(v).toEqual({ ok: true });
  });
});
