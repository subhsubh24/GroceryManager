import { describe, expect, it } from "vitest";
import { parseQuickCapture } from "./parse.js";

describe("parseQuickCapture", () => {
  it("returns [] for empty input", () => {
    expect(parseQuickCapture("")).toEqual([]);
    expect(parseQuickCapture(null)).toEqual([]);
    expect(parseQuickCapture("   ")).toEqual([]);
  });

  it("splits a conversational sentence and strips lead filler", () => {
    expect(parseQuickCapture("we're out of olive oil and need taco stuff")).toEqual([
      { name: "olive oil" },
      { name: "taco stuff" },
    ]);
  });

  it("handles comma + 'and' lists", () => {
    expect(parseQuickCapture("milk, eggs, and bread")).toEqual([
      { name: "milk" },
      { name: "eggs" },
      { name: "bread" },
    ]);
  });

  it("extracts a leading quantity + unit, leaving the item name", () => {
    expect(parseQuickCapture("need 2 lbs chicken and some spinach")).toEqual([
      { name: "chicken", qtyText: "2 lbs" },
      { name: "spinach" },
    ]);
  });

  it("keeps a bare count as qty without eating the item name", () => {
    expect(parseQuickCapture("3 eggs")).toEqual([{ name: "eggs", qtyText: "3" }]);
    expect(parseQuickCapture("2 apples")).toEqual([{ name: "apples", qtyText: "2" }]);
  });

  it("strips item-level filler words", () => {
    expect(parseQuickCapture("some fresh basil")).toEqual([{ name: "basil" }]);
    expect(parseQuickCapture("a dozen eggs")).toEqual([{ name: "dozen eggs" }]); // "dozen" kept as part of name when not after a number
  });

  it("dedupes repeated items", () => {
    expect(parseQuickCapture("milk, milk, and milk")).toEqual([{ name: "milk" }]);
  });

  it("handles newlines and trailing punctuation", () => {
    expect(parseQuickCapture("get coffee\nbuy sugar.")).toEqual([
      { name: "coffee" },
      { name: "sugar" },
    ]);
  });
});
