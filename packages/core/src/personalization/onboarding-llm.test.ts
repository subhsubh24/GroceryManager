import { describe, expect, it } from "vitest";
import type { GeminiClient } from "../llm/client.js";
import { nextOnboardingTurn, type OnboardingTurn } from "./onboarding-llm.js";
import { projectUserModel } from "./user-model.js";

/**
 * A fake Gemini that returns a fixed structured turn (no network). `nextOnboardingTurn` re-validates
 * what comes back, so these tests pin the contract: schema shape is preserved, disallowed topics are
 * dropped, and values/confidence are normalized.
 */
function fakeClient(turn: unknown): GeminiClient {
  return {
    async generateStructured() {
      return turn;
    },
  } as unknown as GeminiClient;
}

describe("nextOnboardingTurn", () => {
  it("returns the turn shape and keeps only allowed, normalized signals", async () => {
    const client = fakeClient({
      reply: "Love that. Any allergies I should plan around?",
      done: false,
      signals: [
        // diet/allergen emitted as "neutral" by the model — MUST be coerced to "positive" or the
        // projection silently drops them (sign("neutral") === 0). This is the safety-critical case.
        { topic: "DIET:Vegetarian", value: "Vegetarian", polarity: "neutral", confidence: 0.9 },
        { topic: "allergen:peanut", value: "peanut", polarity: "neutral", confidence: 0.95 },
        { topic: "cuisine:thai", value: "thai", polarity: "positive", confidence: 0.8 },
        { topic: "ingredient:cilantro", value: "cilantro", polarity: "negative", confidence: 1.4 }, // clamps to 1
        // obviously-disallowed topics — must be filtered out (the projection ignores them):
        { topic: "mood:happy", value: "happy", polarity: "positive", confidence: 0.9 },
        { topic: "budget", value: "120", polarity: "neutral", confidence: 0.9 },
        { topic: "diet:", value: null, polarity: "neutral", confidence: 0.9 }, // empty key → dropped
      ],
    } satisfies OnboardingTurn & { signals: unknown[] });

    const turn = await nextOnboardingTurn(client, [{ role: "user", content: "I'm vegetarian and love Thai" }]);

    expect(turn.reply).toContain("allergies");
    expect(turn.done).toBe(false);
    // Only the four allowed signals survive: topic lowercased, confidence clamped, and diet/allergen
    // coerced to "positive"; cuisine/ingredient keep the model's polarity.
    expect(turn.signals).toEqual([
      { topic: "diet:vegetarian", value: "vegetarian", polarity: "positive", confidence: 0.9 },
      { topic: "allergen:peanut", value: "peanut", polarity: "positive", confidence: 0.95 },
      { topic: "cuisine:thai", value: "thai", polarity: "positive", confidence: 0.8 },
      { topic: "ingredient:cilantro", value: "cilantro", polarity: "negative", confidence: 1 },
    ]);
  });

  it("emits signals that actually move the UserModel (end-to-end through projectUserModel)", async () => {
    // Guards the headline bug: a diet + allergy stated in chat must land in the materialized model
    // the planner/ranking read — not get silently dropped by a neutral polarity.
    const client = fakeClient({
      reply: "Got it!",
      done: false,
      signals: [
        { topic: "diet:vegan", value: "vegan", polarity: "neutral", confidence: 0.9 },
        { topic: "allergen:shellfish", value: "shellfish", polarity: "neutral", confidence: 0.95 },
        { topic: "cuisine:indian", value: "indian", polarity: "positive", confidence: 0.8 },
        { topic: "ingredient:olives", value: "olives", polarity: "negative", confidence: 0.7 },
      ],
    });
    const turn = await nextOnboardingTurn(client, [{ role: "user", content: "vegan, shellfish allergy" }]);
    const model = projectUserModel(turn.signals);
    expect(model.diets).toContain("vegan");
    expect(model.allergens).toContain("shellfish");
    expect(model.cuisineAffinity.indian).toBeGreaterThan(0.3);
    expect(model.dislikes).toContain("olives");
  });

  it("passes through a done wrap-up with no signals", async () => {
    const client = fakeClient({
      reply: "Perfect — I've got a great picture of your taste. Let's get cooking!",
      done: true,
      signals: [],
    });
    const turn = await nextOnboardingTurn(client, [{ role: "assistant", content: "..." }]);
    expect(turn.done).toBe(true);
    expect(turn.signals).toEqual([]);
  });
});
