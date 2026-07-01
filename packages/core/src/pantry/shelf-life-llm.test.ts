import { describe, expect, it } from "vitest";
import type { GeminiClient } from "../llm/client.js";
import { createLlmShelfLifeEstimator } from "./shelf-life-llm.js";
import { estimateShelfLife, type ShelfLifeEstimate } from "./shelf-life.js";

/** A fake GeminiClient returning `answer` (or throwing) from generateStructured. */
function fakeClient(answer: ShelfLifeEstimate | (() => never)): GeminiClient {
  return {
    generateStructured: async () => {
      if (typeof answer === "function") return answer();
      return answer;
    },
  } as unknown as GeminiClient;
}

describe("createLlmShelfLifeEstimator", () => {
  it("returns the model's estimate when it is well-formed", async () => {
    const modelAnswer: ShelfLifeEstimate = {
      domain: "grocery",
      perishability: "perishable",
      shelfLifeFridgeDays: 5,
      shelfLifePantryDays: null,
    };
    const estimate = createLlmShelfLifeEstimator(fakeClient(modelAnswer));
    expect(await estimate("fresh mozzarella")).toEqual(modelAnswer);
  });

  it("accepts a shelf-stable item with both shelf lives null", async () => {
    const modelAnswer: ShelfLifeEstimate = {
      domain: "household",
      perishability: "shelf_stable",
      shelfLifeFridgeDays: null,
      shelfLifePantryDays: null,
    };
    const estimate = createLlmShelfLifeEstimator(fakeClient(modelAnswer));
    expect(await estimate("dish soap")).toEqual(modelAnswer);
  });

  it("distrusts a perishable answer with no shelf life and falls back to the heuristic", async () => {
    // A perishable/semi-perishable with both days null would never age out — reject it.
    const bogus: ShelfLifeEstimate = {
      domain: "grocery",
      perishability: "perishable",
      shelfLifeFridgeDays: null,
      shelfLifePantryDays: null,
    };
    const estimate = createLlmShelfLifeEstimator(fakeClient(bogus));
    expect(await estimate("cilantro")).toEqual(estimateShelfLife("cilantro"));
  });

  it("also rejects a semi_perishable answer with no shelf life", async () => {
    const bogus: ShelfLifeEstimate = {
      domain: "grocery",
      perishability: "semi_perishable",
      shelfLifeFridgeDays: null,
      shelfLifePantryDays: null,
    };
    const estimate = createLlmShelfLifeEstimator(fakeClient(bogus));
    expect(await estimate("sourdough bread")).toEqual(estimateShelfLife("sourdough bread"));
  });

  it("falls back to the deterministic estimate when the model throws", async () => {
    const estimate = createLlmShelfLifeEstimator(
      fakeClient(() => {
        throw new Error("timeout");
      }),
    );
    expect(await estimate("greek yogurt")).toEqual(estimateShelfLife("greek yogurt"));
  });
});
