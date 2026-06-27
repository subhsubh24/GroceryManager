import { describe, expect, it } from "vitest";
import type { GeminiClient } from "../llm/client.js";
import { importRecipe } from "./import-llm.js";

/** Minimal valid RecipeImportFields payload the fake model "returns". */
const FIELDS = {
  title: "Tomato Soup",
  servings: "4",
  ingredients: [{ name: "tomatoes", measure: "1 kg" }],
  instructions: ["Simmer", "Blend"],
};

/** Fake GeminiClient; records call count so we can assert the JSON-LD path skips the model. */
function fakeClient(): { client: GeminiClient; calls: () => number } {
  let n = 0;
  const client = {
    generateStructured: async () => {
      n += 1;
      return FIELDS;
    },
  } as unknown as GeminiClient;
  return { client, calls: () => n };
}

/** Build a fetch stub returning the given html with a chosen status. */
function fetchStub(html: string, status = 200): typeof fetch {
  return (async () => ({ ok: status >= 200 && status < 300, status, text: async () => html })) as unknown as typeof fetch;
}

const ldHtml = (recipe: Record<string, unknown>) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(recipe)}</script></head><body>x</body></html>`;

describe("importRecipe", () => {
  it("imports pasted text via the model (method 'llm')", async () => {
    const { client, calls } = fakeClient();
    const out = await importRecipe({ text: "tomato soup recipe..." }, { client });
    expect(out.method).toBe("llm");
    expect(out.recipe.title).toBe("Tomato Soup");
    expect(calls()).toBe(1);
  });

  it("prefers deterministic JSON-LD for a URL and skips the model (method 'json-ld')", async () => {
    const { client, calls } = fakeClient();
    const html = ldHtml({ "@type": "Recipe", name: "Page Soup", recipeIngredient: ["2 tomatoes", "1 onion"] });
    const out = await importRecipe(
      { url: "https://recipes.example.com/soup" },
      { client, fetchImpl: fetchStub(html) },
    );
    expect(out.method).toBe("json-ld");
    expect(out.recipe.ingredients.length).toBeGreaterThan(0);
    expect(calls()).toBe(0); // JSON-LD short-circuits the LLM
  });

  it("falls back to the model when a URL has no usable JSON-LD (method 'llm')", async () => {
    const { client, calls } = fakeClient();
    const out = await importRecipe(
      { url: "https://recipes.example.com/plain" },
      { client, fetchImpl: fetchStub("<html><body>just prose, no structured data</body></html>") },
    );
    expect(out.method).toBe("llm");
    expect(calls()).toBe(1);
  });

  it("imports a photo via the vision model (method 'llm')", async () => {
    const { client, calls } = fakeClient();
    const out = await importRecipe(
      { image: { dataBase64: "deadbeef", mimeType: "image/jpeg" } },
      { client },
    );
    expect(out.method).toBe("llm");
    expect(out.recipe.title).toBe("Tomato Soup");
    expect(calls()).toBe(1);
  });

  it("rejects a non-public URL (SSRF guard)", async () => {
    await expect(importRecipe({ url: "http://localhost/secret" }, { client: fakeClient().client })).rejects.toThrow();
  });

  it("throws a friendly error on a non-ok fetch", async () => {
    await expect(
      importRecipe(
        { url: "https://recipes.example.com/missing" },
        { client: fakeClient().client, fetchImpl: fetchStub("", 404) },
      ),
    ).rejects.toThrow(/404/);
  });

  it("throws when neither URL, text, nor image is provided", async () => {
    await expect(importRecipe({}, { client: fakeClient().client })).rejects.toThrow();
  });
});
