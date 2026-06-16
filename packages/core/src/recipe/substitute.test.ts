import { describe, expect, it } from "vitest";
import { findSubstitutions } from "./substitute.js";

describe("findSubstitutions", () => {
  it("finds common swaps (with measure noise / plurals stripped)", () => {
    expect(findSubstitutions("buttermilk")[0]!.text).toMatch(/lemon juice|vinegar/i);
    expect(findSubstitutions("Eggs").length).toBeGreaterThan(0); // plural → "egg"
    expect(findSubstitutions("Self-Rising Flour")[0]!.text).toMatch(/baking powder/i);
  });

  it("does not confuse buttermilk with milk", () => {
    // "milk" must not hijack "buttermilk"
    expect(findSubstitutions("buttermilk")[0]!.text).not.toMatch(/plant milk/i);
    expect(findSubstitutions("whole milk")[0]!.text).toMatch(/plant milk|cream/i);
  });

  it("prefers the most specific key", () => {
    // has both "self rising flour" — should match the 3-token key, not a generic one
    const subs = findSubstitutions("self rising flour");
    expect(subs[0]!.uses).toContain("baking powder");
  });

  it("returns [] for unknown ingredients", () => {
    expect(findSubstitutions("dragonfruit")).toEqual([]);
    expect(findSubstitutions("")).toEqual([]);
  });
});
