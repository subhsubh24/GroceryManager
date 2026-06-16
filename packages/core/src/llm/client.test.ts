import { describe, expect, it } from "vitest";
import { extractJsonValue } from "./client.js";

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
