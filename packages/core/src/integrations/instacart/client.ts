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
