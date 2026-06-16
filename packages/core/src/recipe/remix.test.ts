import { describe, expect, it } from "vitest";
import { parseAxis, remixFromTable } from "./remix.js";

describe("remixFromTable", () => {
  it("vegan: swaps animal products (butter + chicken) and never reintroduces them", () => {
    const res = remixFromTable(["2 tbsp butter", "1 chicken breast", "rice"], "vegan");
    expect(res.axis).toBe("vegan");
    expect(res.source).toBe("table");
    const originals = res.swaps.map((s) => s.original);
    expect(originals).toContain("2 tbsp butter");
    expect(originals).toContain("1 chicken breast");
    // No replacement may contain a bare animal product.
    for (const s of res.swaps) {
      expect(s.replacement.toLowerCase()).not.toMatch(/\bchicken\b|\bbeef\b|\bpork\b/);
    }
  });

  it("healthier: swaps white rice toward a lighter alternative", () => {
    const res = remixFromTable(["white rice", "olive oil"], "healthier");
    const rice = res.swaps.find((s) => /rice/i.test(s.original));
    expect(rice).toBeDefined();
    expect(rice!.replacement).toMatch(/brown rice|quinoa/i);
  });

  it("prefers the most specific keyword (white rice over rice)", () => {
    // "white rice" (2 tokens) must beat the faster-axis "rice" generic on the healthier axis.
    const res = remixFromTable(["White Rice"], "healthier");
    expect(res.swaps[0]!.replacement).toMatch(/brown rice|quinoa/i);
  });

  it("cheaper: swaps salmon for a budget option", () => {
    const res = remixFromTable(["salmon fillet"], "cheaper");
    expect(res.swaps[0]!.replacement).toMatch(/tuna/i);
  });

  it("faster: swaps dried beans for canned", () => {
    const res = remixFromTable(["dried beans", "salt"], "faster");
    const beans = res.swaps.find((s) => /beans/i.test(s.original));
    expect(beans!.replacement).toMatch(/canned/i);
  });

  it("is case-insensitive and tolerates measure noise / plurals", () => {
    const res = remixFromTable(["3 EGGS", "Whole Milk"], "vegan");
    const originals = res.swaps.map((s) => s.original);
    expect(originals).toContain("3 EGGS"); // plural "eggs" → "egg"
    expect(originals).toContain("Whole Milk");
  });

  it("dedupes by original ingredient", () => {
    const res = remixFromTable(["butter", "butter", "BUTTER"], "vegan");
    expect(res.swaps).toHaveLength(1);
  });

  it("no matches → empty swaps but a non-empty note is still present", () => {
    const res = remixFromTable(["dragonfruit", "stardust"], "healthier");
    expect(res.swaps).toEqual([]);
    expect(res.note.length).toBeGreaterThan(0);
  });

  it("handles empty / blank ingredients", () => {
    const res = remixFromTable(["", "   "], "vegan");
    expect(res.swaps).toEqual([]);
    expect(res.note.length).toBeGreaterThan(0);
  });

  it("includes a per-axis note that always accompanies the result", () => {
    for (const axis of ["healthier", "cheaper", "faster", "vegan"] as const) {
      expect(remixFromTable([], axis).note.length).toBeGreaterThan(0);
    }
  });
});

describe("parseAxis", () => {
  it("accepts the four valid axes (case-insensitive)", () => {
    expect(parseAxis("vegan")).toBe("vegan");
    expect(parseAxis("CHEAPER")).toBe("cheaper");
    expect(parseAxis(" Faster ")).toBe("faster");
  });

  it("defaults to healthier for invalid / missing input", () => {
    expect(parseAxis("keto")).toBe("healthier");
    expect(parseAxis(null)).toBe("healthier");
    expect(parseAxis(undefined)).toBe("healthier");
    expect(parseAxis("")).toBe("healthier");
  });
});
