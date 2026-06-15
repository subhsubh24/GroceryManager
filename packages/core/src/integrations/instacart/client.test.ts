import { describe, expect, it } from "vitest";
import { buildInstacartSearchUrl, buildListText, buildShoppingListPayload } from "./client.js";

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
