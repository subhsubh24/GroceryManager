import { describe, expect, it } from "vitest";
import { isValidUpc, lookupBarcode, offProductUrl, parseOffProduct } from "./index.js";

describe("isValidUpc", () => {
  it("accepts 8-, 12-, and 13-digit codes (UPC-E/UPC-A/EAN-13)", () => {
    expect(isValidUpc("12345670")).toBe(true); // EAN-8 / UPC-E length
    expect(isValidUpc("036000291452")).toBe(true); // UPC-A
    expect(isValidUpc("0099482400000")).toBe(true); // EAN-13
  });

  it("trims surrounding whitespace before checking", () => {
    expect(isValidUpc("  036000291452  ")).toBe(true);
  });

  it("rejects letters, empty, too-short, and too-long values", () => {
    expect(isValidUpc("")).toBe(false);
    expect(isValidUpc("12345")).toBe(false); // < 6 digits
    expect(isValidUpc("123456789012345")).toBe(false); // > 14 digits
    expect(isValidUpc("12345abc")).toBe(false);
    expect(isValidUpc("0360-0029")).toBe(false);
  });
});

describe("offProductUrl", () => {
  it("builds the fixed Open Food Facts host URL with the trimmed code", () => {
    expect(offProductUrl(" 036000291452 ")).toBe(
      "https://world.openfoodfacts.org/api/v2/product/036000291452.json?fields=product_name,product_name_en,brands",
    );
  });

  it("throws on an invalid UPC so it can't be interpolated into a URL", () => {
    expect(() => offProductUrl("not-a-code")).toThrow();
    expect(() => offProductUrl("")).toThrow();
  });
});

describe("parseOffProduct", () => {
  it("returns the trimmed product_name when found", () => {
    expect(parseOffProduct({ status: 1, product: { product_name: "  Whole Milk  " } })).toEqual({
      name: "Whole Milk",
    });
  });

  it("falls back to product_name_en when product_name is blank/missing", () => {
    expect(
      parseOffProduct({ status: 1, product: { product_name: "  ", product_name_en: "Olive Oil" } }),
    ).toEqual({ name: "Olive Oil" });
  });

  it("returns null when the product is not found (status 0)", () => {
    expect(parseOffProduct({ status: 0, product: {} })).toBeNull();
  });

  it("returns null when found but no usable name", () => {
    expect(parseOffProduct({ status: 1, product: { product_name: "   " } })).toBeNull();
    expect(parseOffProduct({ status: 1, product: {} })).toBeNull();
  });

  it("returns null for junk / non-object input", () => {
    expect(parseOffProduct(null)).toBeNull();
    expect(parseOffProduct("nope")).toBeNull();
    expect(parseOffProduct(42)).toBeNull();
    expect(parseOffProduct({ product: { product_name: "X" } })).toBeNull(); // no status
  });
});

describe("lookupBarcode", () => {
  const ok = (body: unknown): typeof fetch =>
    (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

  it("returns the product name on a successful lookup", async () => {
    const fetchImpl = ok({ status: 1, product: { product_name: "Whole Milk" } });
    await expect(lookupBarcode("036000291452", fetchImpl)).resolves.toEqual({ name: "Whole Milk" });
  });

  it("only ever calls the fixed Open Food Facts host with the validated code", async () => {
    let calledUrl: string | undefined;
    const fetchImpl = (async (input: unknown) => {
      calledUrl = String(input);
      return new Response(JSON.stringify({ status: 1, product: { product_name: "Eggs" } }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    await lookupBarcode("036000291452", fetchImpl);
    expect(calledUrl).toBe(
      "https://world.openfoodfacts.org/api/v2/product/036000291452.json?fields=product_name,product_name_en,brands",
    );
  });

  it("returns null when the product is not found", async () => {
    const fetchImpl = ok({ status: 0 });
    await expect(lookupBarcode("036000291452", fetchImpl)).resolves.toBeNull();
  });

  it("returns null on a non-2xx response", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(lookupBarcode("036000291452", fetchImpl)).resolves.toBeNull();
  });

  it("returns null when fetch throws (network/timeout)", async () => {
    const fetchImpl = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(lookupBarcode("036000291452", fetchImpl)).resolves.toBeNull();
  });

  it("rejects an invalid UPC up front without fetching", async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await expect(lookupBarcode("abc", fetchImpl)).resolves.toBeNull();
    expect(called).toBe(false);
  });
});
