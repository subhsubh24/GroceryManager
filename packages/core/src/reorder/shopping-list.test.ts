import { describe, expect, it } from "vitest";
import { channelForDomain, groupForOrdering, type DueItem } from "./shopping-list.js";

describe("ordering channel routing", () => {
  it("routes by domain", () => {
    expect(channelForDomain("grocery")).toBe("instacart");
    expect(channelForDomain("household")).toBe("amazon");
    expect(channelForDomain("personal_care")).toBe("amazon");
  });

  it("groups due items into instacart vs amazon", () => {
    const items: DueItem[] = [
      { canonicalItemId: "1", name: "whole milk", domain: "grocery", recommendQty: 1000 },
      { canonicalItemId: "2", name: "dish soap", domain: "household", recommendQty: 1, asin: "B001" },
      { canonicalItemId: "3", name: "shampoo", domain: "personal_care", recommendQty: 1, asin: "B002" },
    ];
    const g = groupForOrdering(items);
    expect(g.instacart.map((i) => i.name)).toEqual(["whole milk"]);
    expect(g.amazon.map((i) => i.name)).toEqual(["dish soap", "shampoo"]);
  });
});
