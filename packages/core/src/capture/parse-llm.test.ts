import { describe, expect, it } from "vitest";
import type { GeminiClient } from "../llm/client.js";
import { parseCaptureWithLLM } from "./parse-llm.js";

type CaptureItems = { items: { name: string; qtyText: string | null }[] };

/** A fake GeminiClient whose generateStructured returns `items`; records the prompt it saw. */
function fakeClient(items: CaptureItems["items"]): {
  client: GeminiClient;
  lastPrompt: () => string | null;
  called: () => boolean;
} {
  let prompt: string | null = null;
  let was = false;
  const client = {
    generateStructured: async (_schema: unknown, p: string) => {
      was = true;
      prompt = p;
      return { items };
    },
  } as unknown as GeminiClient;
  return { client, lastPrompt: () => prompt, called: () => was };
}

describe("parseCaptureWithLLM", () => {
  it("returns [] and never calls the model for blank/whitespace input", async () => {
    const { client, called } = fakeClient([]);
    expect(await parseCaptureWithLLM(client, "   \n ")).toEqual([]);
    expect(called()).toBe(false);
  });

  it("lowercases + trims names and keeps a stated quantity", async () => {
    const { client } = fakeClient([{ name: "  Avocado ", qtyText: " 2 " }]);
    const out = await parseCaptureWithLLM(client, "avacados x2");
    expect(out).toEqual([{ name: "avocado", qtyText: "2" }]);
  });

  it("omits qtyText entirely when the model returns null (no invented quantity)", async () => {
    const { client } = fakeClient([{ name: "broccoli", qtyText: null }]);
    const out = await parseCaptureWithLLM(client, "brocoli");
    expect(out).toEqual([{ name: "broccoli" }]);
    expect(out[0]).not.toHaveProperty("qtyText");
  });

  it("drops blank names and de-duplicates case-insensitively (first wins)", async () => {
    const { client } = fakeClient([
      { name: "Milk", qtyText: "1 gal" },
      { name: "  ", qtyText: null },
      { name: "milk", qtyText: "2 gal" },
      { name: "eggs", qtyText: null },
    ]);
    const out = await parseCaptureWithLLM(client, "milk, milk, eggs");
    expect(out).toEqual([{ name: "milk", qtyText: "1 gal" }, { name: "eggs" }]);
  });

  it("caps the result at 50 items", async () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ name: `item${i}`, qtyText: null }));
    const { client } = fakeClient(many);
    const out = await parseCaptureWithLLM(client, "a very long note");
    expect(out).toHaveLength(50);
  });

  it("truncates the note it sends to the model to 1000 chars", async () => {
    const { client, lastPrompt } = fakeClient([{ name: "x", qtyText: null }]);
    const huge = "z".repeat(5000);
    await parseCaptureWithLLM(client, huge);
    // Prompt is `Note:\n${text.slice(0,1000)}` — the sliced body must be exactly 1000 chars.
    const body = lastPrompt()!.replace(/^Note:\n/, "");
    expect(body.length).toBe(1000);
  });

  it("propagates a model/parse failure to the caller (best-effort fallback lives upstream)", async () => {
    const client = {
      generateStructured: async () => {
        throw new Error("model unavailable");
      },
    } as unknown as GeminiClient;
    await expect(parseCaptureWithLLM(client, "eggs")).rejects.toThrow(/model unavailable/);
  });
});
