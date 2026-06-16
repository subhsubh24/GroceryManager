/**
 * Open Food Facts product lookup (keyless, no account). Given a scanned/typed barcode (UPC/EAN), we
 * resolve a human product name to drop on the shopping list. The host is FIXED to Open Food Facts —
 * the only user-controlled part is the barcode, which we constrain to digits, so there is no SSRF
 * surface (unlike the recipe-URL importer, which must guard arbitrary hosts). The parser is pure +
 * tested; the network call injects `fetchImpl` so it's unit-testable without a real request.
 */

/** A barcode is digits only (UPC-E 6–8, UPC-A 12, EAN-13 13, plus the GTIN-14 ceiling). */
export function isValidUpc(code: string): boolean {
  return /^\d{6,14}$/.test(code.trim());
}

/**
 * The FIXED Open Food Facts v2 product endpoint for a barcode. We request only the name fields we
 * use. Throws on an invalid UPC so a bad value can never be interpolated into a URL.
 */
export function offProductUrl(upc: string): string {
  const code = upc.trim();
  if (!isValidUpc(code)) throw new Error(`offProductUrl: invalid UPC ${JSON.stringify(upc)}`);
  return `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_en,brands`;
}

/**
 * Pure: pull a product name out of an Open Food Facts response. The API returns `status === 1` with a
 * `product` object when found (`status === 0` when not). We read `product_name`, falling back to
 * `product_name_en`; trims; returns null when there's no usable name. No fetch, no throw.
 */
export function parseOffProduct(json: unknown): { name: string } | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as { status?: unknown; product?: unknown };
  if (obj.status !== 1) return null;
  if (!obj.product || typeof obj.product !== "object") return null;
  const product = obj.product as { product_name?: unknown; product_name_en?: unknown };
  // Trim each candidate before falling back, so a whitespace-only product_name yields product_name_en.
  const name =
    (typeof product.product_name === "string" ? product.product_name.trim() : "") ||
    (typeof product.product_name_en === "string" ? product.product_name_en.trim() : "");
  return name ? { name } : null;
}

const LOOKUP_TIMEOUT_MS = 5000;
// Open Food Facts asks API clients to send a descriptive User-Agent (app name + contact).
const USER_AGENT = "GroceryManager/1.0 (https://github.com/grocerymanager)";

/**
 * Look up a barcode against Open Food Facts. Guards the UPC, fetches the FIXED endpoint with a ~5s
 * AbortController timeout + descriptive User-Agent, and degrades gracefully: any non-2xx, network
 * error, timeout, or unparseable body returns null (never throws). `fetchImpl` is injectable for
 * tests.
 */
export async function lookupBarcode(
  upc: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ name: string } | null> {
  if (!isValidUpc(upc)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetchImpl(offProductUrl(upc), {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return parseOffProduct(await res.json());
  } catch {
    // Timeout / network / JSON parse — treat as "not found" so the caller can fall back to manual.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
