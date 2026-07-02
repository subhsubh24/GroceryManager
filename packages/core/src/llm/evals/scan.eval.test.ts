/**
 * VISION / SCAN eval (live Gemini) — ROADMAP Track F3, the IMAGE tier.
 *
 * Proves the fridge/pantry SCAN path end-to-end: a COMMITTED photo → base64 → `detectPantryItems`
 * (real Gemini Vision) → the expected grocery items are detected. This is how the image-parsing feature
 * self-validates WITHOUT a live camera/upload: the image files ARE the inputs — captured once, tested
 * forever. Gated behind RUN_EVALS=1 so per-PR CI never spends; runs in the scheduled evals workflow.
 *
 * The fixtures are REAL photographs of open refrigerators (open-licensed, from Wikimedia Commons — see
 * fixtures/images/ATTRIBUTION.md). NOTHING synthetic or AI-generated. Grow coverage over time: add more
 * real fridge/pantry photos under an open license + a matching entry below (the ratchet, §8.5).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { describe, it, expect } from "vitest";
import { GeminiClient, type ImagePart } from "../client.js";
import { detectPantryItems } from "../../vision/detect.js";
import {
  namePresent,
  aggregate,
  formatReport,
  isRateLimitError,
  DEFAULT_THRESHOLD,
  type EvalCaseResult,
} from "./harness.js";

const RUN = process.env.RUN_EVALS === "1";
const DIR = dirname(fileURLToPath(import.meta.url));

type ScanFixture = { name: string; file: string; expected: string[] };

/**
 * Golden scan photos — REAL open-licensed fridge photographs (see fixtures/images/ATTRIBUTION.md).
 * `expected` = grocery items a human verified are clearly visible. Add more real photos here to grow it.
 */
const SCAN_FIXTURES: ScanFixture[] = [
  {
    // Real home fridge, produce-heavy (CC BY-SA 4.0, W.carter).
    name: "fridge-home-produce",
    file: "fixtures/images/fridge-home-produce.jpg",
    expected: ["tomatoes", "oranges", "lemon", "carrots", "grapes", "cheese"],
  },
  {
    // Real showroom fridge with staged food (CC BY 2.0, Maurizio Pesce).
    name: "fridge-showroom",
    file: "fixtures/images/fridge-showroom.jpg",
    expected: ["apples", "pasta"],
  },
];

function imagePart(file: string): ImagePart {
  const bytes = readFileSync(join(DIR, file));
  const mimeType = extname(file).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
  return { mimeType, dataBase64: bytes.toString("base64") };
}

describe.skipIf(!RUN)("vision scan evals (live Gemini)", () => {
  it("detects the grocery items in committed scan photos", async (ctx) => {
    const client = new GeminiClient();
    const results: EvalCaseResult[] = [];
    try {
      for (const f of SCAN_FIXTURES) {
        const detections = await detectPantryItems([imagePart(f.file)], { client });
        const names = detections.map((d) => d.label);
        const missed = f.expected.filter((e) => !namePresent(names, e));
        const recall = f.expected.length ? (f.expected.length - missed.length) / f.expected.length : 1;
        results.push({
          name: f.name,
          score: {
            score: recall,
            ok: recall >= DEFAULT_THRESHOLD,
            detail: missed.length ? [`missed: ${missed.join(", ")} (detected: ${names.join(", ") || "none"})`] : [],
          },
        });
      }
    } catch (e) {
      if (isRateLimitError(e)) return ctx.skip(); // quota blip — not a quality regression
      throw e;
    }
    const report = aggregate(results);
    console.log(formatReport("vision scan", report));
    expect(report.passRate).toBeGreaterThanOrEqual(0.8);
  }, 180_000);
});
