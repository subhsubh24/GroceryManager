import { describe, expect, it } from "vitest";
import {
  aggregate,
  isRateLimitError,
  namePresent,
  scoreReceiptExtraction,
  scoreRecipeImport,
  type EvalCaseResult,
} from "./harness.js";

describe("isRateLimitError (transient API blips → skip, not fail)", () => {
  it("matches rate limits AND provider overloads (429 + 503)", () => {
    expect(isRateLimitError(new Error("got 429 RESOURCE_EXHAUSTED: quota"))).toBe(true);
    expect(
      isRateLimitError(new Error('{"error":{"code":503,"message":"experiencing high demand","status":"UNAVAILABLE"}}')),
    ).toBe(true);
    expect(isRateLimitError(new Error("The model is overloaded. Please try again later."))).toBe(true);
  });
  it("does NOT match a genuine failure (so real regressions still fail loud)", () => {
    expect(isRateLimitError(new Error("400 INVALID_ARGUMENT: bad request"))).toBe(false);
    expect(isRateLimitError(new Error("Gemini call exceeded 8000ms timeout"))).toBe(false);
  });
});

describe("namePresent (fuzzy item matching)", () => {
  it("matches on substring or full token coverage", () => {
    expect(namePresent(["Whole Milk 1 gal"], "milk")).toBe(true);
    expect(namePresent(["3 cloves garlic"], "garlic")).toBe(true);
    expect(namePresent(["Organic Bananas"], "bananas")).toBe(true);
    expect(namePresent(["chicken breast"], "beef")).toBe(false);
  });
});

describe("scoreReceiptExtraction", () => {
  const expected = { retailer: "whole_foods", itemNames: ["milk", "eggs"], totalCents: 1000 };

  it("scores a perfect extraction 1.0", () => {
    const s = scoreReceiptExtraction(
      { retailer: "whole_foods", totalCents: 1000, lineItems: [{ name: "Whole Milk" }, { name: "Large Eggs" }] },
      expected,
    );
    expect(s.score).toBeCloseTo(1);
    expect(s.ok).toBe(true);
  });

  it("penalizes missed items, wrong retailer, and a bad total", () => {
    const s = scoreReceiptExtraction(
      { retailer: "amazon", totalCents: 999, lineItems: [{ name: "Whole Milk" }] },
      expected,
    );
    // recall 0.5 → 0.3, retailer 0, total 0 → 0.3 total
    expect(s.score).toBeCloseTo(0.3);
    expect(s.ok).toBe(false);
    expect(s.detail.join(" ")).toMatch(/missed items: eggs/);
  });
});

describe("scoreRecipeImport", () => {
  const expected = { title: "Garlic Pasta", ingredientNames: ["spaghetti", "garlic"], minSteps: 2 };

  it("scores a faithful import 1.0", () => {
    const s = scoreRecipeImport(
      { title: "Simple Garlic Pasta", ingredients: [{ name: "spaghetti" }, { name: "garlic" }], instructions: "Boil.\nFry." },
      expected,
    );
    expect(s.score).toBeCloseTo(1);
  });

  it("penalizes a missed ingredient and too few steps", () => {
    const s = scoreRecipeImport(
      { title: "Garlic Pasta", ingredients: [{ name: "spaghetti" }], instructions: "Boil." },
      expected,
    );
    // title 0.4 + recall 0.5*0.4=0.2 + steps 0 = 0.6
    expect(s.score).toBeCloseTo(0.6);
    expect(s.ok).toBe(false);
  });
});

describe("aggregate", () => {
  it("computes pass rate, average, and escalation count", () => {
    const results: EvalCaseResult[] = [
      { name: "a", score: { score: 1, ok: true, detail: [] }, tierUsed: "cheap" },
      { name: "b", score: { score: 0.5, ok: false, detail: [] }, tierUsed: "mid" },
    ];
    const r = aggregate(results);
    expect(r).toMatchObject({ total: 2, passed: 1, passRate: 0.5, escalations: 1 });
    expect(r.avgScore).toBeCloseTo(0.75);
  });
});
