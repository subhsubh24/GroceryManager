import { describe, expect, it } from "vitest";
import type { NormalizationResult } from "../ingestion/normalize.js";
import { isSemanticMethod } from "./resolve.js";

describe("isSemanticMethod", () => {
  // Fuzzy (cross-wording) matches → "ask, don't auto-confirm".
  it("treats embedding + llm matches as semantic", () => {
    expect(isSemanticMethod("embedding")).toBe(true);
    expect(isSemanticMethod("llm")).toBe(true);
  });

  // Deterministic matches → safe to auto-confirm.
  it("treats deterministic + manual methods as non-semantic", () => {
    for (const m of ["override", "upc", "trigram", "manual"] as NormalizationResult["method"][]) {
      expect(isSemanticMethod(m)).toBe(false);
    }
  });
});
