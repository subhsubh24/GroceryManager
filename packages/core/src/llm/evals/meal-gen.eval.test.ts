/**
 * Meal-generation eval suite (PLAN §12). Tests generateMeals quality: pantry grounding, dietary
 * compliance, energy-level timing, and step completeness.
 * Gated behind RUN_EVALS=1 + GEMINI_API_KEY.
 *   RUN_EVALS=1 GEMINI_API_KEY=… pnpm --filter @gm/core eval
 */
import { describe, expect, it } from "vitest";
import { GeminiClient } from "../client.js";
import { generateMeals, type GenerateMealsInput } from "../../recipe/generate-llm.js";
import {
  aggregate,
  formatReport,
  isRateLimitError,
  namePresent,
  type EvalCaseResult,
  type EvalScore,
} from "./harness.js";

const RUN = process.env.RUN_EVALS === "1";

interface MealGenFixture {
  name: string;
  input: GenerateMealsInput;
  /** At least these pantry items must appear in usesFromPantry across all generated meals. */
  requiredPantryPresence: string[];
  /** These must NOT appear anywhere in any meal (titles, steps, needFromStore). */
  forbidden?: string[];
  /** All meals must be ≤ this many minutes (when the energy level enforces a time cap). */
  maxMinutes?: number;
}

const MEAL_GEN_FIXTURES: MealGenFixture[] = [
  {
    name: "basic-weeknight",
    input: {
      pantry: ["chicken breast", "garlic", "olive oil", "pasta", "onion", "tomato", "parmesan"],
      expiring: ["chicken breast"],
      energy: "easy",
      count: 3,
    },
    requiredPantryPresence: ["chicken", "pasta"],
    maxMinutes: 30,
  },
  {
    name: "vegan-compliance",
    input: {
      pantry: ["tofu", "broccoli", "rice", "soy sauce", "garlic", "sesame oil"],
      expiring: [],
      energy: "easy",
      diets: ["vegan"],
      count: 2,
    },
    requiredPantryPresence: ["tofu", "broccoli"],
    // Hard vegan exclusions — any leak here is a diet-safety failure
    forbidden: ["chicken", "beef", "pork", "fish", "shrimp", "egg", "milk", "butter", "cream", "cheese"],
    maxMinutes: 30,
  },
  {
    name: "zero-energy-quick",
    input: {
      pantry: ["canned chickpeas", "cucumber", "tomato", "feta", "olive oil", "pita"],
      expiring: [],
      energy: "zero",
      count: 2,
    },
    requiredPantryPresence: ["chickpeas", "cucumber"],
    maxMinutes: 15,
  },
  {
    name: "allergen-exclusion",
    input: {
      pantry: ["gluten-free pasta", "chicken", "olive oil", "garlic", "spinach"],
      expiring: [],
      energy: "easy",
      allergens: ["peanuts", "tree nuts", "shellfish"],
      count: 2,
    },
    requiredPantryPresence: ["chicken", "pasta"],
    forbidden: ["peanut", "almond", "cashew", "walnut", "shrimp", "lobster", "crab"],
  },
];

type Meal = {
  title: string;
  usesFromPantry: string[];
  needFromStore: string[];
  minutes: number;
  steps: string[];
};

/**
 * Score a generated meal set:
 *   - pantry grounding 0.4 — required items appear in usesFromPantry
 *   - diet/allergen compliance 0.3 — no forbidden items in any meal text
 *   - timing 0.2 — all meals ≤ maxMinutes (when specified)
 *   - steps 0.1 — every meal has ≥ 3 steps
 */
function scoreMealSet(actual: Meal[], fx: MealGenFixture): EvalScore {
  const detail: string[] = [];

  const allPantryUsed = actual.flatMap((m) => m.usesFromPantry);
  const missingPantry = fx.requiredPantryPresence.filter((n) => !namePresent(allPantryUsed, n));
  const pantryRecall = fx.requiredPantryPresence.length
    ? (fx.requiredPantryPresence.length - missingPantry.length) / fx.requiredPantryPresence.length
    : 1;
  if (missingPantry.length) detail.push(`pantry items unused: ${missingPantry.join(", ")}`);

  const allText = actual
    .flatMap((m) => [m.title, ...m.steps, ...m.needFromStore])
    .join(" ")
    .toLowerCase();
  const leaked = (fx.forbidden ?? []).filter((f) => allText.includes(f.toLowerCase()));
  if (leaked.length) detail.push(`forbidden items present: ${leaked.join(", ")}`);
  const dietOk = leaked.length === 0;

  let timingOk = true;
  if (fx.maxMinutes != null) {
    const slow = actual.filter((m) => m.minutes > fx.maxMinutes!);
    if (slow.length) {
      detail.push(
        `${slow.length} meal(s) exceed ${fx.maxMinutes}min: ${slow.map((m) => `${m.title}(${m.minutes}min)`).join(", ")}`,
      );
      timingOk = false;
    }
  }

  const thinMeals = actual.filter((m) => m.steps.length < 3);
  if (thinMeals.length) detail.push(`${thinMeals.length} meal(s) have <3 steps`);
  const stepsOk = thinMeals.length === 0;

  const score = 0.4 * pantryRecall + 0.3 * (dietOk ? 1 : 0) + 0.2 * (timingOk ? 1 : 0) + 0.1 * (stepsOk ? 1 : 0);
  return { score, ok: score >= 0.8, detail };
}

describe.skipIf(!RUN)("meal generation evals (live Gemini)", () => {
  it("meets the quality bar across golden meal-gen inputs", async (ctx) => {
    const client = new GeminiClient();
    const results: EvalCaseResult[] = [];
    try {
      for (const fx of MEAL_GEN_FIXTURES) {
        const meals = await generateMeals(client, fx.input);
        results.push({ name: fx.name, score: scoreMealSet(meals, fx) });
      }
    } catch (e) {
      if (isRateLimitError(e)) return ctx.skip();
      throw e;
    }
    const report = aggregate(results);
    console.log(formatReport("meal generation", report));
    expect(report.passRate).toBeGreaterThanOrEqual(0.8);
  }, 180_000);

  it("vegan diet compliance: no animal products in any meal", async (ctx) => {
    const client = new GeminiClient();
    const fx = MEAL_GEN_FIXTURES.find((f) => f.name === "vegan-compliance")!;
    try {
      const meals = await generateMeals(client, fx.input);
      const score = scoreMealSet(meals, fx);
      console.log(
        `[vegan-compliance] score=${score.score.toFixed(2)} detail=${score.detail.join("; ")}`,
      );
      // Any leaked animal product is a hard diet-safety failure for vegan meals.
      expect(score.detail.filter((d) => d.startsWith("forbidden")).length).toBe(0);
    } catch (e) {
      if (isRateLimitError(e)) return ctx.skip();
      throw e;
    }
  }, 120_000);
});
