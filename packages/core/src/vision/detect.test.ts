import { describe, expect, it, vi } from "vitest";
import { GEMINI_MODELS } from "@gm/config/constants";
import type { GenerateOptions, GeminiClient, ImagePart } from "../llm/client.js";
import {
  DEFAULT_SCAN_TIER,
  detectPantryItems,
  scanModelFor,
  type VisionDetection,
} from "./detect.js";

const IMG: ImagePart = { mimeType: "image/jpeg", dataBase64: "Zm9v" };

type GenStructured = (
  schema: unknown,
  prompt: string,
  opts?: GenerateOptions,
) => Promise<{ detections: VisionDetection[] }>;

/** Minimal GeminiClient stub exposing only generateStructured (the one method detect uses). */
function stubClient(detections: VisionDetection[]) {
  const generateStructured = vi.fn<GenStructured>(async () => ({ detections }));
  return { client: { generateStructured } as unknown as GeminiClient, generateStructured };
}

describe("scanModelFor / DEFAULT_SCAN_TIER", () => {
  it("a scan pays for accuracy: defaults to the mid tier", () => {
    expect(DEFAULT_SCAN_TIER).toBe("mid");
  });

  it("maps each tier to its concrete Gemini model", () => {
    expect(scanModelFor("cheap")).toBe(GEMINI_MODELS.cheap);
    expect(scanModelFor("mid")).toBe(GEMINI_MODELS.mid);
    expect(scanModelFor("reasoning")).toBe(GEMINI_MODELS.reasoning);
  });
});

describe("detectPantryItems", () => {
  it("short-circuits with no model call when there are no images", async () => {
    const { client, generateStructured } = stubClient([
      { label: "milk", qtyEstimate: 1, unitGuess: null, presenceConfidence: 1, qtyConfidence: null },
    ]);
    const out = await detectPantryItems([], { client });
    expect(out).toEqual([]);
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("returns the model's detections verbatim", async () => {
    const detections: VisionDetection[] = [
      { label: "greek yogurt", qtyEstimate: 2, unitGuess: null, presenceConfidence: 0.92, qtyConfidence: 0.8 },
      { label: "ketchup", qtyEstimate: null, unitGuess: null, presenceConfidence: 0.7, qtyConfidence: null },
    ];
    const { client, generateStructured } = stubClient(detections);
    const out = await detectPantryItems([IMG], { client });
    expect(out).toEqual(detections);
    expect(generateStructured).toHaveBeenCalledTimes(1);
  });

  it("defaults to the mid tier + high media resolution and threads the location into the system prompt", async () => {
    const { client, generateStructured } = stubClient([]);
    await detectPantryItems([IMG], { client, location: "freezer" });
    const opts = generateStructured.mock.calls[0]![2]!;
    expect(opts.tier).toBe("mid");
    expect(opts.mediaResolution).toBe("high");
    expect(opts.images).toEqual([IMG]);
    expect(opts.system).toContain("freezer");
  });

  it("honors an explicit tier override", async () => {
    const { client, generateStructured } = stubClient([]);
    await detectPantryItems([IMG], { client, tier: "reasoning" });
    const opts = generateStructured.mock.calls[0]![2]!;
    expect(opts.tier).toBe("reasoning");
  });
});
