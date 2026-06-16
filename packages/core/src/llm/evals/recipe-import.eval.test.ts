/**
 * Recipe-import eval suite (PLAN §12). Hits REAL Gemini → gated behind RUN_EVALS=1 + GEMINI_API_KEY.
 *   RUN_EVALS=1 GEMINI_API_KEY=… DATABASE_URL=… pnpm --filter @gm/core eval
 */
import { describe, expect, it } from "vitest";
import { GeminiClient } from "../client.js";
import { importRecipe } from "../../recipe/import-llm.js";
import { aggregate, formatReport, scoreRecipeImport, type EvalCaseResult } from "./harness.js";
import { RECIPE_FIXTURES } from "./fixtures.js";

const RUN = process.env.RUN_EVALS === "1";

describe.skipIf(!RUN)("recipe import evals (live Gemini)", () => {
  it("meets the quality bar across golden recipes", async () => {
    const client = new GeminiClient();
    const results: EvalCaseResult[] = [];
    for (const f of RECIPE_FIXTURES) {
      const { recipe } = await importRecipe({ text: f.text }, { client });
      results.push({ name: f.name, score: scoreRecipeImport(recipe, f.expected) });
    }
    const report = aggregate(results);
    console.log(formatReport("recipe import", report));
    expect(report.passRate).toBeGreaterThanOrEqual(0.8);
  }, 180_000);
});
