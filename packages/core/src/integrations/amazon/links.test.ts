import { describe, expect, it } from "vitest";
import { buildAddToCartUrl, buildProductUrl, buildSubscribeSaveUrl } from "./links.js";

describe("amazon link builders", () => {
  it("builds a prefilled add-to-cart URL with associate tag", () => {
    const url = buildAddToCartUrl([{ asin: "B001", quantity: 2 }, { asin: "B002" }], "gm-20");
    expect(url).toContain("/gp/aws/cart/add.html?");
    expect(url).toContain("AssociateTag=gm-20");
    expect(url).toContain("ASIN.1=B001");
    expect(url).toContain("Quantity.1=2");
    expect(url).toContain("ASIN.2=B002");
    expect(url).toContain("Quantity.2=1"); // default qty
  });

  it("throws on empty cart", () => {
    expect(() => buildAddToCartUrl([])).toThrow();
  });

  it("builds subscribe & save and product URLs", () => {
    expect(buildSubscribeSaveUrl("B003", "gm-20")).toBe("https://www.amazon.com/subscribe-and-save/B003?tag=gm-20");
    expect(buildProductUrl("B004")).toBe("https://www.amazon.com/dp/B004");
  });
});
