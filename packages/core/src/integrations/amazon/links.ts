/**
 * Amazon deep-link builders (PLAN §7.5). Pure string builders — no API key needed.
 * The Add-to-Cart URL pre-fills a cart the user checks out themselves; Subscribe & Save
 * deep-links into Amazon's native recurring program. `associateTag` earns affiliate credit.
 */
const AMAZON_HOST = "https://www.amazon.com";

export interface CartItem {
  asin: string;
  quantity?: number;
}

/** Prefilled-cart deep link: .../gp/aws/cart/add.html?AssociateTag=…&ASIN.1=…&Quantity.1=… */
export function buildAddToCartUrl(items: CartItem[], associateTag?: string): string {
  if (items.length === 0) throw new Error("buildAddToCartUrl: no items");
  const p = new URLSearchParams();
  if (associateTag) p.set("AssociateTag", associateTag);
  items.forEach((it, i) => {
    p.set(`ASIN.${i + 1}`, it.asin);
    p.set(`Quantity.${i + 1}`, String(it.quantity ?? 1));
  });
  return `${AMAZON_HOST}/gp/aws/cart/add.html?${p.toString()}`;
}

/** Subscribe & Save enrollment deep link for a single ASIN. */
export function buildSubscribeSaveUrl(asin: string, associateTag?: string): string {
  const q = associateTag ? `?tag=${encodeURIComponent(associateTag)}` : "";
  return `${AMAZON_HOST}/subscribe-and-save/${asin}${q}`;
}

/** Plain product page (affiliate-tagged). */
export function buildProductUrl(asin: string, associateTag?: string): string {
  const q = associateTag ? `?tag=${encodeURIComponent(associateTag)}` : "";
  return `${AMAZON_HOST}/dp/${asin}${q}`;
}
