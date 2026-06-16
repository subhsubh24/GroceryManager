/**
 * Recipe-remix eval suite (PLAN §12). Hits REAL Gemini → gated behind RUN_EVALS=1 + GEMINI_API_KEY.
 *   RUN_EVALS=1 GEMINI_API_KEY=… DATABASE_URL=… pnpm --filter @gm/core eval
 *
 * Scorers are deterministic keyword checks over the merged remix result: the vegan axis must never
 * reintroduce an animal product AND must address the animal items in the recipe; the healthier axis
 * must produce at least one swap toward a lighter alternative. (An LLM judge could add a semantic
 * signal — see judge.ts / the import eval — but keyword checks are the load-bearing safety gate.)
 */
import { describe, expect, it } from "vitest";
import { GeminiClient } from "../client.js";
import { geminiRemix, suggestRemix } from "../../recipe/remix-llm.js";
import { reintroducesAnimalProduct } from "../../recipe/remix-llm.js";
import type { RemixAxis, RemixResult } from "../../recipe/remix.js";
import {
  aggregate,
  formatReport,
  isRateLimitError,
  namePresent,
  type EvalCaseResult,
  type EvalScore,
} from "./harness.js";

const RUN = process.env.RUN_EVALS === "1";

interface RemixFixture {
  name: string;
  axis: RemixAxis;
  title?: string;
  ingredients: string[];
  /** Recipe ingredients that the remix MUST address with a swap. */
  mustAddress: string[];
}

const REMIX_FIXTURES: RemixFixture[] = [
  {
    name: "vegan-chicken-dinner",
    axis: "vegan",
    title: "Creamy Chicken & Rice",
    ingredients: ["butter", "chicken breast", "milk", "rice"],
    mustAddress: ["butter", "chicken", "milk"],
  },
  {
    name: "vegan-baking",
    axis: "vegan",
    title: "Honey Butter Cake",
    ingredients: ["2 eggs", "1 cup milk", "honey", "flour"],
    mustAddress: ["egg", "milk", "honey"],
  },
  {
    name: "healthier-pasta",
    axis: "healthier",
    title: "Buttery White Rice Bowl",
    ingredients: ["butter", "white rice"],
    mustAddress: ["white rice"],
  },
];

const LIGHTER = /brown rice|quinoa|whole[\s-]?wheat|greek yogurt|olive oil|turkey|less sugar|use less/i;

/** Score a vegan remix: no replacement reintroduces an animal product + the animal items are addressed. */
function scoreVegan(res: RemixResult, fx: RemixFixture): EvalScore {
  const detail: string[] = [];
  const leaks = res.swaps.filter((s) => reintroducesAnimalProduct(s.replacement));
  if (leaks.length) detail.push(`animal-product leaks: ${leaks.map((s) => s.replacement).join(", ")}`);

  const originals = res.swaps.map((s) => s.original);
  const missed = fx.mustAddress.filter((n) => !namePresent(originals, n));
  if (missed.length) detail.push(`unaddressed: ${missed.join(", ")}`);

  const recall = fx.mustAddress.length ? (fx.mustAddress.length - missed.length) / fx.mustAddress.length : 1;
  const noLeak = leaks.length === 0;
  const score = noLeak ? recall : 0; // any leak is a hard fail
  return { score, ok: noLeak && missed.length === 0, detail };
}

/** Score a healthier remix: at least one swap toward a lighter alternative. */
function scoreHealthier(res: RemixResult, fx: RemixFixture): EvalScore {
  const detail: string[] = [];
  const lighter = res.swaps.some((s) => LIGHTER.test(s.replacement));
  if (!lighter) detail.push("no swap toward a lighter alternative");

  const originals = res.swaps.map((s) => s.original);
  const missed = fx.mustAddress.filter((n) => !namePresent(originals, n));
  if (missed.length) detail.push(`unaddressed: ${missed.join(", ")}`);

  const ok = lighter && missed.length === 0;
  return { score: ok ? 1 : 0, ok, detail };
}

describe.skipIf(!RUN)("recipe remix evals (live Gemini)", () => {
  it("meets the quality bar across golden remixes", async (ctx) => {
    const client = new GeminiClient();
    const generate = geminiRemix(client);
    const results: EvalCaseResult[] = [];
    try {
      for (const fx of REMIX_FIXTURES) {
        const res = await suggestRemix(
          { generate },
          { ingredients: fx.ingredients, axis: fx.axis, title: fx.title },
        );
        const score = fx.axis === "vegan" ? scoreVegan(res, fx) : scoreHealthier(res, fx);
        results.push({ name: fx.name, score });
      }
    } catch (e) {
      if (isRateLimitError(e)) return ctx.skip(); // quota blip — not a quality regression
      throw e;
    }
    const report = aggregate(results);
    console.log(formatReport("recipe remix", report));
    expect(report.passRate).toBeGreaterThanOrEqual(0.8);
  }, 180_000);
});
