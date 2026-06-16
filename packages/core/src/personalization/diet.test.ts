import { describe, expect, it } from "vitest";
import { dietExclusions, KNOWN_DIETS } from "./diet.js";

describe("dietExclusions", () => {
  it("maps a diet to the ingredients it forbids", () => {
    const vegan = dietExclusions(["vegan"]);
    expect(vegan).toEqual(expect.arrayContaining(["beef", "chicken", "egg", "milk", "cheese"]));
    expect(dietExclusions(["pescatarian"])).toContain("beef");
    expect(dietExclusions(["pescatarian"])).not.toContain("salmon"); // fish allowed
    expect(dietExclusions(["gluten-free"])).toEqual(expect.arrayContaining(["wheat", "pasta"]));
  });

  it("unions multiple diets and de-dupes", () => {
    const both = dietExclusions(["vegetarian", "gluten-free"]);
    expect(both).toContain("beef");
    expect(both).toContain("flour");
    expect(new Set(both).size).toBe(both.length);
  });

  it("is case-insensitive and ignores unknown diets", () => {
    expect(dietExclusions(["VEGAN"]).length).toBeGreaterThan(0);
    expect(dietExclusions(["paleo-ish-fad"])).toEqual([]);
    expect(dietExclusions([])).toEqual([]);
  });

  it("exposes the known diet keys", () => {
    expect(KNOWN_DIETS).toContain("vegan");
    expect(KNOWN_DIETS).toContain("dairy-free");
  });
});
