import { describe, expect, it } from "vitest";
import { mergeInstacartItems } from "./draft-order.js";

const due = (name: string, recommendQty?: number | null, unit?: string | null) => ({ name, recommendQty, unit });

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
