import { describe, expect, it } from "vitest";
import { buildCombinedInstacartPayload, mergeInstacartItems } from "./draft-order.js";
import type { DueItem } from "./shopping-list.js";

const due = (name: string, recommendQty?: number | null, unit?: string | null) => ({ name, recommendQty, unit });

const dueItem = (name: string, recommendQty: number | null = null, unit: string | null = null): DueItem => ({
  canonicalItemId: name,
  name,
  domain: "grocery",
  recommendQty,
  unit,
});

describe("mergeInstacartItems", () => {
  it("combines due staples with the active list into one deduped order", () => {
    const merged = mergeInstacartItems(
      [due("Milk", 2, "gal"), due("Eggs", 1, "dozen")],
      [{ name: "Tortillas" }, { name: "Lime" }],
    );
    expect(merged).toEqual([
      { name: "Milk", quantity: 2, unit: "gal" },
      { name: "Eggs", quantity: 1, unit: "dozen" },
      { name: "Tortillas" },
      { name: "Lime" },
    ]);
  });

  it("de-dupes by normalized name, with the due staple (its quantity) winning", () => {
    const merged = mergeInstacartItems([due("milk", 2, "gal")], [{ name: "  Milk " }, { name: "bread" }]);
    expect(merged).toEqual([{ name: "milk", quantity: 2, unit: "gal" }, { name: "bread" }]);
  });

  it("drops blank list names and passes through quantity-less due items", () => {
    const merged = mergeInstacartItems([due("salt")], [{ name: "  " }, { name: "pepper" }]);
    expect(merged).toEqual([{ name: "salt" }, { name: "pepper" }]);
  });

  it("is empty when there is nothing on either side", () => {
    expect(mergeInstacartItems([], [])).toEqual([]);
  });
});

describe("buildCombinedInstacartPayload", () => {
  it("builds one shopping_list payload from due staples + the active list", () => {
    const payload = buildCombinedInstacartPayload(
      [dueItem("Milk", 2, "gal")],
      [{ name: "Bread" }],
      "My cart",
    );
    expect(payload).toEqual({
      title: "My cart",
      link_type: "shopping_list",
      line_items: [{ name: "Milk", quantity: 2, unit: "gal" }, { name: "Bread" }],
    });
  });

  it("falls back to the default cart title", () => {
    const payload = buildCombinedInstacartPayload([dueItem("Eggs")], []);
    expect(payload?.title).toBe("Your GroceryManager list");
  });

  it("returns null when there is nothing to order — never sends an empty cart", () => {
    expect(buildCombinedInstacartPayload([], [])).toBeNull();
    // Blank-only names dedupe away to nothing → still null, not an empty-item payload.
    expect(buildCombinedInstacartPayload([], [{ name: "   " }])).toBeNull();
  });
});
