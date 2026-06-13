import { describe, expect, it } from "vitest";
import { bodyText, detectRetailer, extractBody, headerValue, isReceiptEmail, type GmailPart } from "./parse.js";

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");

describe("gmail classification", () => {
  it("detects the retailer from the sender", () => {
    expect(detectRetailer("Amazon.com <auto-confirm@amazon.com>")).toBe("amazon");
    expect(detectRetailer("Whole Foods Market <receipts@wholefoodsmarket.com>")).toBe("whole_foods");
    expect(detectRetailer("Instacart <orders@instacart.com>")).toBe("instacart");
    expect(detectRetailer("Bank <no-reply@chase.com>")).toBeNull();
  });

  it("flags receipts only for known retailers with a receipt-y subject", () => {
    expect(isReceiptEmail({ from: "x@instacart.com", subject: "Your order has been delivered" })).toEqual({
      isReceipt: true,
      retailer: "instacart",
    });
    expect(isReceiptEmail({ from: "x@instacart.com", subject: "Weekly deals!" }).isReceipt).toBe(false);
    expect(isReceiptEmail({ from: "x@chase.com", subject: "Your order" }).isReceipt).toBe(false);
  });
});

describe("gmail body extraction", () => {
  const payload: GmailPart = {
    mimeType: "multipart/alternative",
    headers: [{ name: "From", value: "a@wholefoodsmarket.com" }],
    parts: [
      { mimeType: "text/plain", body: { data: b64url("Bananas $1.99") } },
      {
        mimeType: "multipart/related",
        parts: [{ mimeType: "text/html", body: { data: b64url("<p>Bananas $1.99</p>") } }],
      },
    ],
  };

  it("reads headers case-insensitively", () => {
    expect(headerValue(payload.headers, "from")).toBe("a@wholefoodsmarket.com");
  });

  it("extracts nested html + text and prefers html", () => {
    const { html, text } = extractBody(payload);
    expect(html).toBe("<p>Bananas $1.99</p>");
    expect(text).toBe("Bananas $1.99");
    expect(bodyText(payload)).toBe("<p>Bananas $1.99</p>");
  });
});
