import { describe, expect, it } from "vitest";
import type { GeminiClient } from "../llm/client.js";
import { createLlmNormalizer } from "./llm-normalizer.js";
import type { CanonicalCandidate } from "./normalize.js";

type ResolveValue = { matchId: string | null; createName: string | null; confidence: number };

/**
 * Fake client that faithfully runs the provided verifier and throws on failure — exactly what the
 * real generateWithVerify does when verify-then-escalate is exhausted. Lets us test both the
 * verifier wiring and the resolver's post-processing without the network.
 */
function fakeClient(value: ResolveValue): GeminiClient {
  return {
    async generateWithVerify({ verify }: { verify?: (v: ResolveValue) => { ok: boolean; reason?: string } }) {
      const verdict = verify ? verify(value) : { ok: true };
      if (!verdict.ok) throw new Error(verdict.reason ?? "verify failed");
      return { value, tierUsed: "cheap", attempts: 1, verified: true };
    },
  } as unknown as GeminiClient;
}

const cands: CanonicalCandidate[] = [
  { id: "c-milk", name: "whole milk", score: 0.5 },
  { id: "c-oat", name: "oat milk", score: 0.4 },
];

describe("createLlmNormalizer", () => {
  it("returns a candidate id when the model picks a valid one", async () => {
    const norm = createLlmNormalizer(fakeClient({ matchId: "c-oat", createName: null, confidence: 0.88 }));
    const r = await norm("OATLY OAT MILK 64OZ", cands);
    expect(r).toEqual({ canonicalItemId: "c-oat", createName: null, confidence: 0.88 });
  });

  it("proposes a clean new canonical name when nothing matches", async () => {
    const norm = createLlmNormalizer(fakeClient({ matchId: null, createName: "olive oil", confidence: 0.8 }));
    const r = await norm("CALIF EXTRA VIRGIN OO", []);
    expect(r).toEqual({ canonicalItemId: null, createName: "olive oil", confidence: 0.8 });
  });

  it("rejects a hallucinated id (verifier fails → defers to review)", async () => {
    const norm = createLlmNormalizer(fakeClient({ matchId: "c-ketchup", createName: null, confidence: 0.99 }));
    const r = await norm("HEINZ KETCHUP", cands);
    expect(r).toEqual({ canonicalItemId: null, createName: null, confidence: 0 });
  });

  it("defers to review when the model neither matches nor proposes", async () => {
    const norm = createLlmNormalizer(fakeClient({ matchId: null, createName: "   ", confidence: 0.7 }));
    const r = await norm("???", cands);
    expect(r.canonicalItemId).toBeNull();
    expect(r.createName).toBeNull();
    expect(r.confidence).toBe(0);
  });

  it("prefers the match and drops a stray createName, and clamps confidence", async () => {
    const norm = createLlmNormalizer(fakeClient({ matchId: "c-milk", createName: "whole milk", confidence: 1.5 }));
    const r = await norm("365 WHOLE MILK", cands);
    expect(r.canonicalItemId).toBe("c-milk");
    expect(r.createName).toBeNull();
    expect(r.confidence).toBe(1);
  });
});
