/**
 * Capture-parse eval suite (PLAN §12). Tests parseCaptureWithLLM quality: spelling correction,
 * multi-item splitting, quantity extraction, brand dropping, deduplication.
 * Gated behind RUN_EVALS=1 + GEMINI_API_KEY.
 *   RUN_EVALS=1 GEMINI_API_KEY=… pnpm --filter @gm/core eval
 */
import { describe, expect, it } from "vitest";
import { GeminiClient } from "../client.js";
import { parseCaptureWithLLM } from "../../capture/parse-llm.js";
import {
  aggregate,
  formatReport,
  isRateLimitError,
  namePresent,
  type EvalCaseResult,
  type EvalScore,
} from "./harness.js";

const RUN = process.env.RUN_EVALS === "1";

interface CaptureFixture {
  name: string;
  input: string;
  /** At least these items must appear in the output (recall). */
  expectedItems: string[];
  /** These strings must NOT appear in any output item name (brand names, filler, etc.). */
  forbidden?: string[];
}

const CAPTURE_FIXTURES: CaptureFixture[] = [
  {
    name: "misspelling-correction",
    input: "avacado, brocoli, choclate chips",
    expectedItems: ["avocado", "broccoli", "chocolate chips"],
  },
  {
    name: "multi-item-run-on",
    input: "I need some milk and a dozen eggs and maybe some bread for tomorrow",
    expectedItems: ["milk", "eggs", "bread"],
    forbidden: ["some", "maybe"],
  },
  {
    name: "quantity-extraction",
    input: "2 lbs chicken breast and 3 cans tomatoes",
    expectedItems: ["chicken", "tomatoes"],
  },
  {
    name: "brand-dropping",
    input: "Heinz ketchup, Organic Valley whole milk, Tropicana orange juice",
    expectedItems: ["ketchup", "milk", "orange juice"],
    forbidden: ["heinz", "organic valley", "tropicana"],
  },
  {
    name: "deduplication",
    input: "apples, apple, bananas, banana, eggs",
    expectedItems: ["apple", "banana", "eggs"],
  },
];

/** Score a capture result: recall of expected items (0.7) + forbidden items absent (0.3). */
function scoreCaptureFixture(actual: { name: string }[], fx: CaptureFixture): EvalScore {
  const detail: string[] = [];
  const names = actual.map((i) => i.name);

  const missed = fx.expectedItems.filter((n) => !namePresent(names, n));
  const recall = fx.expectedItems.length
    ? (fx.expectedItems.length - missed.length) / fx.expectedItems.length
    : 1;
  if (missed.length) detail.push(`missed: ${missed.join(", ")}`);

  const leaked = (fx.forbidden ?? []).filter((f) => namePresent(names, f));
  if (leaked.length) detail.push(`forbidden present: ${leaked.join(", ")}`);
  const forbiddenOk = leaked.length === 0;

  const score = 0.7 * recall + 0.3 * (forbiddenOk ? 1 : 0);
  return { score, ok: score >= 0.8, detail };
}

describe.skipIf(!RUN)("capture parse evals (live Gemini)", () => {
  it("meets the quality bar across golden capture inputs", async (ctx) => {
    const client = new GeminiClient();
    const results: EvalCaseResult[] = [];
    try {
      for (const fx of CAPTURE_FIXTURES) {
        const items = await parseCaptureWithLLM(client, fx.input);
        results.push({ name: fx.name, score: scoreCaptureFixture(items, fx) });
      }
    } catch (e) {
      if (isRateLimitError(e)) return ctx.skip();
      throw e;
    }
    const report = aggregate(results);
    console.log(formatReport("capture parse", report));
    expect(report.passRate).toBeGreaterThanOrEqual(0.8);
  }, 180_000);
});
