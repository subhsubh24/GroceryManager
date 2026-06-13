import { describe, expect, it } from "vitest";
import { buildShoppingListPayload } from "./client.js";

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
