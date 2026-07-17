import { describe, expect, it } from "vitest";
import { buildExtractionPrompt, cleanReceiptText } from "./receipt-parse.js";

const HTML = `
<html><head><style>.x{color:red}</style><title>Order</title></head>
<body>
  <h1>Whole Foods Market</h1>
  <table>
    <tr><td>Organic Bananas</td><td>$1.99</td></tr>
    <tr><td>365 Whole Milk</td><td>$3.49</td></tr>
  </table>
  <script>track();</script>
  <p>Total: $5.48</p>
</body></html>`;

describe("cleanReceiptText", () => {
  it("strips tags/scripts/styles and keeps the receipt content", () => {
    const out = cleanReceiptText(HTML);
    expect(out).toContain("Organic Bananas");
    expect(out).toContain("365 Whole Milk");
    expect(out).toContain("5.48");
    expect(out).not.toContain("<td>");
    expect(out).not.toContain("track()"); // script removed
    expect(out).not.toContain("color:red"); // style removed
  });
});

describe("buildExtractionPrompt", () => {
  it("includes the cleaned text and an optional retailer hint", () => {
    const p = buildExtractionPrompt("Bananas 1.99", "whole_foods");
    expect(p).toContain("Bananas 1.99");
    expect(p).toContain("whole_foods");
  });

  it("omits the retailer-hint line when no hint is given", () => {
    // extractReceipt calls this with opts.retailerHint, which is optional — the
    // no-hint path (the ternary's else branch) is the common case and must not
    // inject a stray "Likely retailer" line into the prompt.
    const p = buildExtractionPrompt("Bananas 1.99");
    expect(p).toContain("Bananas 1.99");
    expect(p).not.toContain("Likely retailer");
  });
});
