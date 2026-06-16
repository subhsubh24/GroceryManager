/**
 * Receipt-extraction eval suite (PLAN §12). Hits REAL Gemini, so it's gated behind RUN_EVALS=1
 * (and needs GEMINI_API_KEY). Excluded from the default, deterministic, offline test run.
 *   RUN_EVALS=1 GEMINI_API_KEY=… DATABASE_URL=… pnpm --filter @gm/core eval
 */
import { describe, expect, it } from "vitest";
import { GeminiClient } from "../client.js";
import { extractReceipt } from "../../ingestion/receipt-parse.js";
import {
  aggregate,
  formatReport,
  isRateLimitError,
  scoreReceiptExtraction,
  type EvalCaseResult,
} from "./harness.js";
import { llmJudge } from "./judge.js";
import { RECEIPT_FIXTURES } from "./fixtures.js";

const RUN = process.env.RUN_EVALS === "1";

describe.skipIf(!RUN)("receipt extraction evals (live Gemini)", () => {
  it("meets the quality bar across golden receipts", async (ctx) => {
    const client = new GeminiClient();
    const results: EvalCaseResult[] = [];
    try {
      for (const f of RECEIPT_FIXTURES) {
        const r = await extractReceipt(client, f.text, { retailerHint: f.retailerHint });
        results.push({
          name: f.name,
          score: scoreReceiptExtraction(r.value, f.expected),
          tierUsed: r.tierUsed,
          attempts: r.attempts,
        });
      }
    } catch (e) {
      if (isRateLimitError(e)) return ctx.skip(); // quota blip — not a quality regression
      throw e;
    }
    const report = aggregate(results);
    console.log(formatReport("receipt extraction", report));
    expect(report.passRate).toBeGreaterThanOrEqual(0.8);
  }, 180_000);

  it("LLM-as-judge agrees the extraction is faithful", async (ctx) => {
    const client = new GeminiClient();
    const f = RECEIPT_FIXTURES[0]!;
    try {
      const r = await extractReceipt(client, f.text, { retailerHint: f.retailerHint });
      const j = await llmJudge(
        client,
        `Does this JSON faithfully capture every purchased item and the total from a ${f.retailerHint} receipt? Expected items: ${f.expected.itemNames.join(", ")}.`,
        JSON.stringify(r.value),
      );
      console.log(`[judge] ${f.name}: ${j.score.toFixed(2)} — ${j.reason}`);
      expect(j.score).toBeGreaterThanOrEqual(0.7);
    } catch (e) {
      if (isRateLimitError(e)) return ctx.skip();
      throw e;
    }
  }, 120_000);
});
