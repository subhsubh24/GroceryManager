import { describe, expect, it } from "vitest";
import type { GeminiClient } from "../llm/client.js";
import { getSubstitutions } from "./substitute-llm.js";

type Subs = { substitutions: { text: string; uses: string[] }[] };

/** A fake GeminiClient whose generateStructured runs the given impl; records whether it was called. */
function fakeClient(impl: () => Promise<Subs>): { client: GeminiClient; called: () => boolean } {
  let was = false;
  const client = {
    generateStructured: async () => {
      was = true;
      return impl();
    },
  } as unknown as GeminiClient;
  return { client, called: () => was };
}

describe("getSubstitutions", () => {
  it("returns curated-table results and never calls the LLM (source 'known')", async () => {
    const { client, called } = fakeClient(async () => ({ substitutions: [] }));
    const res = await getSubstitutions("buttermilk", client);
    expect(res.source).toBe("known");
    expect(res.substitutions.length).toBeGreaterThan(0);
    expect(called()).toBe(false); // the static table short-circuits the LLM
  });

  it("falls back to the LLM for an unknown ingredient (source 'ai')", async () => {
    const { client, called } = fakeClient(async () => ({
      substitutions: [{ text: "1 tsp turmeric + pinch paprika", uses: ["turmeric", "paprika"] }],
    }));
    const res = await getSubstitutions("saffron", client);
    expect(res.source).toBe("ai");
    expect(res.substitutions).toEqual([{ text: "1 tsp turmeric + pinch paprika", uses: ["turmeric", "paprika"] }]);
    expect(called()).toBe(true);
  });

  it("trims whitespace and drops empty AI suggestions", async () => {
    const { client } = fakeClient(async () => ({
      substitutions: [
        { text: "  swap A  ", uses: ["a"] },
        { text: "   ", uses: [] },
      ],
    }));
    const res = await getSubstitutions("saffron", client);
    expect(res.source).toBe("ai");
    expect(res.substitutions).toEqual([{ text: "swap A", uses: ["a"] }]);
  });

  it("returns 'none' when the LLM yields no usable suggestions", async () => {
    const { client } = fakeClient(async () => ({ substitutions: [{ text: "   ", uses: [] }] }));
    const res = await getSubstitutions("saffron", client);
    expect(res).toEqual({ source: "none", substitutions: [] });
  });

  it("returns 'none' (never throws) when the LLM call fails", async () => {
    const { client } = fakeClient(async () => {
      throw new Error("LLM unavailable");
    });
    const res = await getSubstitutions("saffron", client);
    expect(res).toEqual({ source: "none", substitutions: [] });
  });
});
