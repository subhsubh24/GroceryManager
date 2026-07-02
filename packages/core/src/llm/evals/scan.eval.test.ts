/**
 * VISION / SCAN eval (live Gemini) — ROADMAP Track F3, the IMAGE tier.
 *
 * Proves the fridge/pantry SCAN path end-to-end: a COMMITTED photo → base64 → `detectPantryItems`
 * (real Gemini Vision) → the expected grocery items are detected. This is how the image-parsing feature
 * self-validates WITHOUT a live camera/upload: the image files ARE the inputs — captured once, tested
 * forever. Gated behind RUN_EVALS=1 so per-PR CI never spends; runs in the scheduled evals workflow.
 *
 * Ratchet (§8.5): whenever a REAL scan mis-detects, drop that photo into fixtures/images/ with its
 * expected items — coverage grows monotonically.
 *
 * NOTE on fidelity: `shelf-bootstrap.png` is a clearly-labeled synthetic shelf — it proves the PIPELINE
 * (image → real vision model → detections → assertions). A synthetic image is a lossy fixture for a vision
 * model; for real accuracy, add REAL fridge/pantry photos (they validate the model, not just the plumbing).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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

/** Golden scan photos. Add REAL fridge/pantry/receipt photos here as the ratchet fills in. */
const SCAN_FIXTURES: ScanFixture[] = [
  {
    name: "labeled-shelf-bootstrap",
    file: "fixtures/images/shelf-bootstrap.png",
    expected: ["milk", "eggs", "bread", "bananas", "tomato sauce", "orange juice"],
  },
];

function imagePart(file: string): ImagePart {
  const bytes = readFileSync(join(DIR, file));
  return { mimeType: "image/png", dataBase64: bytes.toString("base64") };
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
