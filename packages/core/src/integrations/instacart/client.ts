/**
 * Instacart Developer Platform client (PLAN §7.1). Output/deep-link only — there is NO
 * cart/order/checkout/payment endpoint. We build a shopping-list page and the user checks out
 * on Instacart (the "agentic up to one tap" boundary). The payload builder is pure + tested;
 * the network calls are key-gated at runtime.
 */
export interface InstacartLineItem {
  name: string;
  quantity?: number;
  unit?: string;
  display_text?: string;
  upcs?: string[];
}

export interface ShoppingListPayload {
  title: string;
  image_url?: string;
  link_type: "shopping_list";
  line_items: InstacartLineItem[];
}

export interface ListItemInput {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  upc?: string | null;
}

/** Build the IDP `products_link` request body for a shopping-list page. */
export function buildShoppingListPayload(title: string, items: ListItemInput[]): ShoppingListPayload {
  return {
    title,
    link_type: "shopping_list",
    line_items: items.map((it) => ({
      name: it.name,
      ...(it.quantity != null ? { quantity: it.quantity } : {}),
      ...(it.unit ? { unit: it.unit } : {}),
      ...(it.upc ? { upcs: [it.upc] } : {}),
    })),
  };
}

/**
 * Keyless deep-link into Instacart's public search for one item. Opening a search is exactly what a
 * shopper does by hand — no API key, no scraping, no ToS issue. This is the no-key ordering fallback:
 * the IDP shopping-list page (createShoppingListPage) needs an API key + ~30–40 day production
 * approval; this needs neither, and the official prefill drops in transparently once a key exists.
 */
export function buildInstacartSearchUrl(query: string): string {
  return `https://www.instacart.com/store/s?k=${encodeURIComponent(query.trim())}`;
}

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/**
 * Plain-text checklist for clipboard / paste / print — the always-works keyless fallback (paste into
 * Instacart, any grocery app, or notes). Blank names are skipped; quantity+unit are prefixed when set.
 */
export function buildListText(
  items: { name: string; quantity?: number | null; unit?: string | null }[],
  title = "Shopping list",
): string {
  const lines: string[] = [];
  for (const it of items) {
    const name = it.name?.trim();
    if (!name) continue;
    const qty = it.quantity != null ? `${formatQty(it.quantity)}${it.unit ? ` ${it.unit}` : ""} ` : "";
    lines.push(`- ${qty}${name}`);
  }
  return [title, ...lines].join("\n");
}

const IDP_BASE = "https://connect.instacart.com/idp/v1";

export class InstacartClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = IDP_BASE,
  ) {}

  private headers() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` };
  }

  /** Create a shareable shopping-list page; returns the hosted Instacart URL. */
  async createShoppingListPage(payload: ShoppingListPayload): Promise<{ url: string }> {
    const res = await fetch(`${this.baseUrl}/products/products_link`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Instacart ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { products_link_url: string };
    return { url: json.products_link_url };
  }

  /** Nearby retailers for a postal code (used to pick a store before ordering). */
  async getNearbyRetailers(postalCode: string, countryCode = "US"): Promise<unknown> {
    const res = await fetch(
      `${this.baseUrl}/retailers?postal_code=${encodeURIComponent(postalCode)}&country_code=${countryCode}`,
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error(`Instacart ${res.status}: ${await res.text()}`);
    return res.json();
  }
}
