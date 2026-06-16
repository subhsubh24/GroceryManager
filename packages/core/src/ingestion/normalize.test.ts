import { describe, expect, it } from "vitest";
import {
  normalizeLineItem,
  type NormalizationInput,
  type NormalizationPorts,
} from "./normalize.js";

function fakePorts(over: Partial<NormalizationPorts> = {}): NormalizationPorts {
  return {
    findOverride: async () => null,
    findByUpc: async () => null,
    trigramCandidates: async () => [],
    embeddingCandidates: async () => [],
    llmResolve: async () => ({ canonicalItemId: null, createName: null, confidence: 0 }),
    createCanonical: async () => "new-id",
    ...over,
  };
}

const input: NormalizationInput = { rawText: "365 ORG WHOLE MILK", name: "whole milk", upc: "099482400000" };

describe("normalizeLineItem cascade", () => {
  it("1. override wins outright", async () => {
    const r = await normalizeLineItem(input, fakePorts({ findOverride: async () => "milk-id" }));
    expect(r).toEqual({ canonicalItemId: "milk-id", method: "override", confidence: 1, needsReview: false });
  });

  it("2. UPC exact match", async () => {
    const r = await normalizeLineItem(input, fakePorts({ findByUpc: async () => "milk-id" }));
    expect(r.method).toBe("upc");
    expect(r.canonicalItemId).toBe("milk-id");
  });

  it("3. trigram above threshold", async () => {
    const r = await normalizeLineItem(
      input,
      fakePorts({ trigramCandidates: async () => [{ id: "milk-id", name: "whole milk", score: 0.8 }] }),
    );
    expect(r.method).toBe("trigram");
    expect(r.confidence).toBeCloseTo(0.8, 6);
  });

  it("4. embedding when trigram is weak", async () => {
    const r = await normalizeLineItem(
      input,
      fakePorts({
        trigramCandidates: async () => [{ id: "x", name: "milkshake", score: 0.3 }],
        embeddingCandidates: async () => [{ id: "milk-id", name: "whole milk", score: 0.9 }],
      }),
    );
    expect(r.method).toBe("embedding");
    expect(r.canonicalItemId).toBe("milk-id");
  });

  it("5. LLM tiebreak picks a candidate", async () => {
    const r = await normalizeLineItem(
      input,
      fakePorts({
        trigramCandidates: async () => [{ id: "milk-id", name: "whole milk", score: 0.4 }],
        llmResolve: async () => ({ canonicalItemId: "milk-id", createName: null, confidence: 0.95 }),
      }),
    );
    expect(r.method).toBe("llm");
    expect(r.canonicalItemId).toBe("milk-id");
  });

  it("5b. LLM proposes a new canonical when nothing matches", async () => {
    const r = await normalizeLineItem(
      input,
      fakePorts({ llmResolve: async () => ({ canonicalItemId: null, createName: "whole milk", confidence: 0.9 }) }),
    );
    expect(r.method).toBe("llm");
    expect(r.canonicalItemId).toBe("new-id"); // createCanonical result
  });

  it("6. all weak → needs review (never silently mutate)", async () => {
    const r = await normalizeLineItem(
      input,
      fakePorts({ llmResolve: async () => ({ canonicalItemId: null, createName: null, confidence: 0.2 }) }),
    );
    expect(r.needsReview).toBe(true);
  });
});
