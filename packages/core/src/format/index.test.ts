import { describe, it, expect } from "vitest";
import { titleCase } from "./index.js";

describe("titleCase", () => {
  it("capitalizes each word (canonical names are stored lowercase)", () => {
    expect(titleCase("organic hass avocados")).toBe("Organic Hass Avocados");
  });

  it("normalizes ALL-CAPS receipt text", () => {
    expect(titleCase("WHOLE MILK")).toBe("Whole Milk");
  });

  it("keeps small connecting words lowercase mid-phrase but capitalizes them when leading", () => {
    expect(titleCase("loaf of bread")).toBe("Loaf of Bread");
    expect(titleCase("of mice")).toBe("Of Mice");
  });

  it("collapses irregular whitespace", () => {
    expect(titleCase("  spring   onions ")).toBe("Spring Onions");
  });

  it("is idempotent on already-cased input", () => {
    expect(titleCase("Whole Milk")).toBe("Whole Milk");
  });

  it("returns an empty string for blank input (never throws)", () => {
    expect(titleCase("")).toBe("");
    expect(titleCase("   ")).toBe("");
  });
});
