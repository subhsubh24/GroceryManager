import { describe, expect, it } from "vitest";
import type { GeminiClient } from "../llm/client.js";
import { answersToSignals, parseFreeTextPreferences } from "./onboarding.js";
import { projectUserModel } from "./user-model.js";

describe("answersToSignals", () => {
  it("maps the structured interview to typed signals (normalized, deduped)", () => {
    const signals = answersToSignals({
      diets: ["Vegetarian"],
      allergens: ["Peanut", "peanut"], // dupe + case
      lovedCuisines: ["Thai"],
      dislikedIngredients: [" Cilantro "],
      qualityPrefs: ["organic"],
    });
    const topics = signals.map((s) => `${s.topic}:${s.polarity}`).sort();
    expect(topics).toEqual([
      "allergen:peanut:positive",
      "cuisine:thai:positive",
      "diet:vegetarian:positive",
      "ingredient:cilantro:negative",
      "quality:organic:positive",
    ]);
  });

  it("projects straight into the UserModel the planner reads", () => {
    const model = projectUserModel(
      answersToSignals({
        diets: ["vegan"],
        allergens: ["shellfish"],
        lovedCuisines: ["indian"],
        dislikedIngredients: ["olives"],
      }),
    );
    expect(model.diets).toContain("vegan");
    expect(model.allergens).toContain("shellfish");
    expect(model.dislikes).toContain("olives");
    expect(model.cuisineAffinity.indian).toBeGreaterThan(0.3); // registers as a love
  });

  it("returns nothing for empty answers", () => {
    expect(answersToSignals({})).toEqual([]);
  });
});

function fakeClient(signals: unknown): GeminiClient {
  return {
    async generateStructured() {
      return { signals };
    },
  } as unknown as GeminiClient;
}

describe("parseFreeTextPreferences", () => {
  it("turns a free-text answer into typed, normalized signals", async () => {
    const client = fakeClient([
      { kind: "diet", key: "Vegetarian", polarity: "positive", confidence: 0.9 },
      { kind: "cuisine", key: "thai", polarity: "positive", confidence: 0.8 },
      { kind: "ingredient", key: "cilantro", polarity: "negative", confidence: 0.85 },
      { kind: "ingredient", key: "", polarity: "negative", confidence: 0.5 }, // dropped (empty key)
    ]);
    const out = await parseFreeTextPreferences(client, "I'm veggie, love thai, hate cilantro");
    expect(out).toHaveLength(3);
    expect(out.find((s) => s.topic === "diet:vegetarian")?.confidence).toBe(0.9);
    expect(out.find((s) => s.topic === "ingredient:cilantro")?.polarity).toBe("negative");
  });

  it("is a no-op on empty input and never throws on model failure", async () => {
    expect(await parseFreeTextPreferences(fakeClient([]), "  ")).toEqual([]);
    const boom = { async generateStructured() { throw new Error("model down"); } } as unknown as GeminiClient;
    expect(await parseFreeTextPreferences(boom, "anything")).toEqual([]);
  });

  it("clamps out-of-range confidence", async () => {
    const out = await parseFreeTextPreferences(
      fakeClient([{ kind: "quality", key: "organic", polarity: "positive", confidence: 1.7 }]),
      "buy organic",
    );
    expect(out[0]!.confidence).toBe(1);
  });
});
