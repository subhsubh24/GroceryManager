import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildInstacartSearchUrl,
  buildListText,
  buildShoppingListPayload,
  InstacartClient,
} from "./client.js";

function stubFetch(json: unknown, init?: { ok?: boolean; status?: number; text?: string }) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, reqInit?: RequestInit) => {
    calls.push({ url: String(url), init: reqInit });
    return {
      ok: init?.ok ?? true,
      status: init?.status ?? 200,
      json: async () => json,
      text: async () => init?.text ?? "",
    } as Response;
  });
  vi.stubGlobal("fetch", fn);
  const call = (i = 0) => {
    const c = calls[i];
    if (!c) throw new Error(`expected fetch call #${i} but it was not made`);
    return c;
  };
  return { call };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildShoppingListPayload", () => {
  it("maps list items to IDP line items, omitting empty fields", () => {
    const payload = buildShoppingListPayload("This week", [
      { name: "whole milk", quantity: 1, unit: "l", upc: "099482400000" },
      { name: "bananas", quantity: null, unit: null, upc: null },
    ]);
    expect(payload.link_type).toBe("shopping_list");
    expect(payload.title).toBe("This week");
    expect(payload.line_items[0]).toEqual({ name: "whole milk", quantity: 1, unit: "l", upcs: ["099482400000"] });
    expect(payload.line_items[1]).toEqual({ name: "bananas" }); // nulls dropped
  });
});

describe("buildInstacartSearchUrl (keyless fallback)", () => {
  it("builds a public search deep-link and url-encodes the query", () => {
    expect(buildInstacartSearchUrl("milk")).toBe("https://www.instacart.com/store/s?k=milk");
    expect(buildInstacartSearchUrl("olive oil")).toBe("https://www.instacart.com/store/s?k=olive%20oil");
    expect(buildInstacartSearchUrl("Ben & Jerry's")).toBe(
      "https://www.instacart.com/store/s?k=Ben%20%26%20Jerry's",
    );
  });

  it("trims surrounding whitespace before encoding", () => {
    expect(buildInstacartSearchUrl("  eggs  ")).toBe("https://www.instacart.com/store/s?k=eggs");
  });
});

describe("buildListText (keyless fallback)", () => {
  it("renders a titled bullet list with quantity + unit when present", () => {
    const text = buildListText(
      [
        { name: "Milk", quantity: 2, unit: "each" },
        { name: "Spinach" },
      ],
      "Your GroceryManager list",
    );
    expect(text).toBe("Your GroceryManager list\n- 2 each Milk\n- Spinach");
  });

  it("formats fractional quantities to 2 decimals and omits a missing unit", () => {
    expect(buildListText([{ name: "Chicken", quantity: 1.5 }])).toBe("Shopping list\n- 1.5 Chicken");
  });

  it("skips blank names and trims", () => {
    expect(buildListText([{ name: "  " }, { name: " Garlic " }])).toBe("Shopping list\n- Garlic");
  });

  it("returns just the title when there are no items", () => {
    expect(buildListText([])).toBe("Shopping list");
  });
});

describe("InstacartClient (network methods)", () => {
  const client = new InstacartClient("idp-key", "https://idp.test/idp/v1");

  it("createShoppingListPage returns the hosted url, bearer-auths, and passes a timeout signal", async () => {
    const { call } = stubFetch({ products_link_url: "https://instacart.com/list/xyz" });
    const payload = buildShoppingListPayload("This week", [{ name: "milk" }]);
    const res = await client.createShoppingListPage(payload);

    expect(res).toEqual({ url: "https://instacart.com/list/xyz" });
    expect(call().url).toBe("https://idp.test/idp/v1/products/products_link");
    expect(call().init?.method).toBe("POST");
    expect((call().init?.headers as Record<string, string>).Authorization).toBe("Bearer idp-key");
    expect(JSON.parse(String(call().init?.body)).title).toBe("This week");
    expect(call().init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("createShoppingListPage throws on a non-ok response so the route can fall back to the keyless path", async () => {
    stubFetch(null, { ok: false, status: 500, text: "boom" });
    await expect(
      client.createShoppingListPage(buildShoppingListPayload("x", [])),
    ).rejects.toThrow(/Instacart 500/);
  });

  it("getNearbyRetailers url-encodes the postal code and passes a timeout signal", async () => {
    const { call } = stubFetch({ retailers: [] });
    await client.getNearbyRetailers("94107 ", "US");
    expect(call().url).toBe("https://idp.test/idp/v1/retailers?postal_code=94107%20&country_code=US");
    expect(call().init?.signal).toBeInstanceOf(AbortSignal);
  });
});
