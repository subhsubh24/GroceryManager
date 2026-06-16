import { describe, expect, it } from "vitest";
import {
  reintroducesAnimalProduct,
  suggestRemix,
  verifyRemixDraft,
  type RemixDraft,
  type RemixGenerator,
} from "./remix-llm.js";

describe("reintroducesAnimalProduct", () => {
  it("flags bare animal products", () => {
    expect(reintroducesAnimalProduct("chicken broth")).toBe(true);
    expect(reintroducesAnimalProduct("a splash of cream")).toBe(true);
    expect(reintroducesAnimalProduct("grated cheese")).toBe(true);
  });

  it("flags animal-qualified dairy that only looks plant-ish", () => {
    expect(reintroducesAnimalProduct("buttermilk")).toBe(true);
    expect(reintroducesAnimalProduct("whole milk")).toBe(true);
    expect(reintroducesAnimalProduct("clarified butter")).toBe(true);
    expect(reintroducesAnimalProduct("chicken fat")).toBe(true);
  });

  it("allows vegan/plant-qualified versions", () => {
    expect(reintroducesAnimalProduct("vegan butter")).toBe(false);
    expect(reintroducesAnimalProduct("plant milk")).toBe(false);
    expect(reintroducesAnimalProduct("plant-based cream")).toBe(false);
    expect(reintroducesAnimalProduct("vegan cheese or nutritional yeast")).toBe(false);
  });

  it("allows plant-source dairy/egg alternatives (the real-world vegan swaps)", () => {
    expect(reintroducesAnimalProduct("oat milk")).toBe(false);
    expect(reintroducesAnimalProduct("coconut cream")).toBe(false);
    expect(reintroducesAnimalProduct("flax egg (1 tbsp ground flaxseed + 3 tbsp water)")).toBe(false);
    expect(reintroducesAnimalProduct("coconut bacon")).toBe(false);
    expect(reintroducesAnimalProduct("cashew cheese")).toBe(false);
  });

  it("allows clearly plant ingredients", () => {
    expect(reintroducesAnimalProduct("olive oil")).toBe(false);
    expect(reintroducesAnimalProduct("tofu or chickpeas")).toBe(false);
    expect(reintroducesAnimalProduct("maple syrup")).toBe(false);
  });
});

describe("verifyRemixDraft", () => {
  const draft = (swaps: RemixDraft["swaps"]): RemixDraft => ({ swaps, note: "n" });

  it("rejects a vegan draft that reintroduces an animal product", () => {
    const v = verifyRemixDraft(
      draft([{ original: "butter", replacement: "chicken fat", reason: "r" }]),
      "vegan",
    );
    expect(v.ok).toBe(false);
  });

  it("accepts a clean vegan draft", () => {
    const v = verifyRemixDraft(
      draft([{ original: "butter", replacement: "olive oil", reason: "r" }]),
      "vegan",
    );
    expect(v.ok).toBe(true);
  });

  it("does not enforce the animal-product rule on non-vegan axes", () => {
    const v = verifyRemixDraft(
      draft([{ original: "salmon", replacement: "canned tuna", reason: "r" }]),
      "cheaper",
    );
    expect(v.ok).toBe(true);
  });
});

describe("suggestRemix", () => {
  it("returns the deterministic table result when no generate is provided", async () => {
    const res = await suggestRemix({}, { ingredients: ["butter", "chicken breast"], axis: "vegan" });
    expect(res.source).toBe("table");
    expect(res.swaps.length).toBeGreaterThan(0);
  });

  it("enriches and merges LLM swaps onto the table (source becomes llm)", async () => {
    const generate: RemixGenerator = async (req) => {
      const draft: RemixDraft = {
        // "honey" isn't in the table for these inputs → a genuinely new swap to merge in.
        swaps: [{ original: "honey", replacement: "maple syrup", reason: "plant sweetener" }],
        note: "Made it plant-based.",
      };
      expect(req.verify(draft).ok).toBe(true); // request carries the verifier
      return draft;
    };
    const res = await suggestRemix({ generate }, { ingredients: ["butter", "honey"], axis: "vegan" });
    expect(res.source).toBe("llm");
    expect(res.note).toBe("Made it plant-based.");
    const originals = res.swaps.map((s) => s.original);
    expect(originals).toContain("butter"); // from the table
    expect(originals).toContain("honey"); // from the LLM
  });

  it("falls back to the table when the LLM draft fails verification (vegan leak)", async () => {
    const generate: RemixGenerator = async () => ({
      swaps: [{ original: "butter", replacement: "clarified butter", reason: "bad" }],
      note: "leaky",
    });
    const res = await suggestRemix({ generate }, { ingredients: ["butter"], axis: "vegan" });
    expect(res.source).toBe("table");
    expect(res.note).not.toBe("leaky");
  });

  it("falls back to the table when the LLM generate throws", async () => {
    const generate: RemixGenerator = async () => {
      throw new Error("network down");
    };
    const res = await suggestRemix({ generate }, { ingredients: ["white rice"], axis: "healthier" });
    expect(res.source).toBe("table");
    expect(res.swaps[0]!.replacement).toMatch(/brown rice|quinoa/i);
  });
});
