import { describe, expect, it } from "vitest";
import { cleanTranscript, parseQuickCapture } from "./parse.js";

describe("cleanTranscript", () => {
  it("returns '' for empty/nullish input", () => {
    expect(cleanTranscript("")).toBe("");
    expect(cleanTranscript(null)).toBe("");
    expect(cleanTranscript(undefined)).toBe("");
    expect(cleanTranscript("   ")).toBe("");
  });

  it("collapses whitespace and trims", () => {
    expect(cleanTranscript("  milk   and   eggs  ")).toBe("milk and eggs");
    expect(cleanTranscript("two\nlbs\tchicken")).toBe("two lbs chicken");
  });

  it("strips a single trailing period only", () => {
    expect(cleanTranscript("we need milk.")).toBe("we need milk");
    expect(cleanTranscript("milk and eggs..")).toBe("milk and eggs.");
    expect(cleanTranscript("3.5 lbs chicken")).toBe("3.5 lbs chicken");
  });
});

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
