import { describe, expect, it } from "vitest";
import { extractJsonValue, l2normalize } from "./client.js";

describe("l2normalize", () => {
  it("scales a vector to unit length", () => {
    const v = l2normalize([3, 4]); // |[3,4]| = 5
    expect(v[0]).toBeCloseTo(0.6);
    expect(v[1]).toBeCloseTo(0.8);
    expect(Math.hypot(...v)).toBeCloseTo(1);
  });

  it("returns zeros for a zero vector (no NaN)", () => {
    expect(l2normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("leaves an already-normalized vector unit-length", () => {
    expect(Math.hypot(...l2normalize([0, 1]))).toBeCloseTo(1);
  });
});

describe("extractJsonValue (code-execution output parsing)", () => {
  it("parses clean JSON", () => {
    expect(extractJsonValue('{"totalCents":1176}')).toEqual({ totalCents: 1176 });
  });

  it("parses a ```json fenced block", () => {
    expect(extractJsonValue('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("parses JSON wrapped in prose (chatty cheaper tiers)", () => {
    const text = 'The user wants the total. {"lineItems":[{"name":"Milk","cents":449}],"totalCents":449} Done.';
    expect(extractJsonValue(text)).toEqual({ lineItems: [{ name: "Milk", cents: 449 }], totalCents: 449 });
  });

  it("parses a top-level array", () => {
    expect(extractJsonValue("result: [1,2,3]")).toEqual([1, 2, 3]);
  });

  it("throws when there's no JSON to extract", () => {
    expect(() => extractJsonValue("no json here")).toThrow(/no JSON/);
  });
});
