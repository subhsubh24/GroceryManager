import { describe, expect, it } from "vitest";
import type { GeminiClient } from "../llm/client.js";
import { energyGuide, generateMeals, type GeneratedMeal } from "./generate-llm.js";

describe("energyGuide", () => {
  it("maps each energy level to its time budget", () => {
    expect(energyGuide("nice").maxMinutes).toBe(999);
    expect(energyGuide("easy").maxMinutes).toBe(30);
    expect(energyGuide("zero").maxMinutes).toBe(15);
  });

  it("carries a prose note per level", () => {
    expect(energyGuide("zero").note).toMatch(/15 min/);
    expect(energyGuide("easy").note).toMatch(/30 min/);
    expect(energyGuide("nice").note).toMatch(/no time/i);
  });
});

const ONE_MEAL: GeneratedMeal = {
  title: "Tomato & egg scramble",
  description: "A quick, savory one-pan scramble.",
  usesFromPantry: ["eggs", "tomato"],
  needFromStore: ["scallions"],
  minutes: 12,
  effort: "low",
  steps: ["Whisk eggs", "Soften tomato", "Scramble together", "Plate"],
};

/** A fake GeminiClient that records the schema + prompt + opts it was called with. */
function fakeClient(): { client: GeminiClient; calls: { schema: unknown; prompt: string; opts: unknown }[] } {
  const calls: { schema: unknown; prompt: string; opts: unknown }[] = [];
  const client = {
    generateStructured: async (schema: unknown, prompt: string, opts: unknown) => {
      calls.push({ schema, prompt, opts });
      return { meals: [ONE_MEAL] };
    },
  } as unknown as GeminiClient;
  return { client, calls };
}

describe("generateMeals", () => {
  it("returns the validated meals from the client", async () => {
    const { client } = fakeClient();
    const meals = await generateMeals(client, { pantry: ["eggs", "tomato"], expiring: ["tomato"], energy: "zero" });
    expect(meals).toHaveLength(1);
    expect(meals[0]!.title).toBe("Tomato & egg scramble");
    expect(meals[0]!.needFromStore).toEqual(["scallions"]);
  });

  it("passes a schema, the cheap tier, a system prompt, and the pantry into the call", async () => {
    const { client, calls } = fakeClient();
    await generateMeals(client, {
      pantry: ["eggs", "tomato", "spinach"],
      expiring: ["spinach"],
      energy: "easy",
      diets: ["vegetarian"],
      allergens: ["peanut"],
      loves: ["garlic"],
      dislikes: ["cilantro"],
    });
    expect(calls).toHaveLength(1);
    const { schema, prompt, opts } = calls[0]!;
    expect(schema).toBeTruthy();
    expect(opts).toMatchObject({ tier: "cheap" });
    expect((opts as { system?: string }).system).toMatch(/home chef/i);
    // The prompt should ground the model in the pantry, expiring items, energy, and constraints.
    expect(prompt).toContain("spinach");
    expect(prompt).toContain("vegetarian");
    expect(prompt).toContain("peanut");
    expect(prompt).toMatch(/30 minutes/);
  });

  it("defaults to 4 meals when count is omitted", async () => {
    const { client, calls } = fakeClient();
    await generateMeals(client, { pantry: ["rice"], expiring: [], energy: "nice" });
    expect(calls[0]!.prompt).toMatch(/Generate 4 meal ideas/);
  });

  it("clamps count out of range (and tolerates it without throwing)", async () => {
    const { client, calls } = fakeClient();
    await generateMeals(client, { pantry: ["rice"], expiring: [], energy: "nice", count: 99 });
    expect(calls[0]!.prompt).toMatch(/Generate 6 meal ideas/);

    const { client: c2, calls: calls2 } = fakeClient();
    await generateMeals(c2, { pantry: ["rice"], expiring: [], energy: "nice", count: 0 });
    expect(calls2[0]!.prompt).toMatch(/Generate 1 meal idea\b/);
  });

  it("caps a huge pantry to bound the prompt", async () => {
    const { client, calls } = fakeClient();
    const big = Array.from({ length: 60 }, (_, i) => `item${i}`);
    await generateMeals(client, { pantry: big, expiring: [], energy: "easy" });
    // item39 is the last kept (first 40); item40 is dropped.
    expect(calls[0]!.prompt).toContain("item39");
    expect(calls[0]!.prompt).not.toContain("item40");
  });
});
