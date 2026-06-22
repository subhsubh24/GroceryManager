/**
 * Meal IDEA GENERATION from the user's own pantry (additive feature) — the generative complement to
 * the curated/retrieval recipe path (recipe/index.ts + TheMealDBProvider). Where the ranker RETRIEVES
 * existing recipes, this INVENTS meals from what the user already has, tuned to an energy level and
 * honoring diets/allergens, using up expiring items first.
 *
 * Server-only (pulls @google/genai via the Gemini client), so — like substitute-llm/remix-llm — it
 * lives OUTSIDE the client-safe @gm/core/recipe barrel and is reached via the
 * "@gm/core/recipe/generate-llm" subpath. The web client never imports this; it calls a server action.
 */
import { z } from "zod";
import type { GeminiClient } from "../llm/client.js";

/** How much the user feels like cooking. Drives the time/effort/ingredient budget in the prompt. */
export type MealEnergy = "nice" | "easy" | "zero";

export interface GenerateMealsInput {
  /** In-stock pantry item names (the raw material the meals should be built from). */
  pantry: string[];
  /** Names to use FIRST (expiring soon). May be a subset of `pantry`, or extra items. */
  expiring: string[];
  energy: MealEnergy;
  /** Hard dietary constraints, e.g. "vegan" — every meal must satisfy these. */
  diets?: string[];
  /** Hard excludes — never appear in any meal (allergens + diet-derived exclusions). */
  allergens?: string[];
  /** Taste to favor when there's a choice. */
  loves?: string[];
  /** Taste to avoid (soft). */
  dislikes?: string[];
  /** How many ideas to return. Default 4, clamped to 1..6. */
  count?: number;
}

export interface GeneratedMeal {
  title: string;
  /** One appetizing line. */
  description: string;
  /** Pantry items this meal uses (so the UI can show "uses" chips). */
  usesFromPantry: string[];
  /** Few/none items not on hand (kept small — the point is to cook from what you have). */
  needFromStore: string[];
  minutes: number;
  effort: "low" | "medium" | "high";
  /** 3-6 short steps. */
  steps: string[];
}

/** The structured payload the LLM returns: a list of meals. Re-validated by generateStructured. */
const MealsSchema = z.object({
  meals: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      usesFromPantry: z.array(z.string()),
      needFromStore: z.array(z.string()),
      minutes: z.number(),
      effort: z.enum(["low", "medium", "high"]),
      steps: z.array(z.string()),
    }),
  ),
});

/**
 * The time/effort budget per energy level. Pure (no I/O) so it's unit-testable and shared between the
 * prompt and any future UI copy. `maxMinutes` is a hint passed to the model; `note` is the prose rule.
 */
export function energyGuide(energy: MealEnergy): { maxMinutes: number; note: string } {
  switch (energy) {
    case "nice":
      return { maxMinutes: 999, note: "no time/effort limit, can be involved" };
    case "easy":
      return { maxMinutes: 30, note: "≤30 min, low cleanup, one-pan when possible" };
    case "zero":
      return {
        maxMinutes: 15,
        note: "≤15 min, no-cook or one-pan, ≤5 ingredients, minimal cleanup",
      };
  }
}

const SYSTEM =
  "You are a resourceful home chef. Invent appealing meals MOSTLY from the ingredients the user " +
  "already HAS, minimizing what they'd need to buy. Honor the energy level (time/effort budget), " +
  "every dietary constraint, and never include an excluded/allergen ingredient. Prioritize using up " +
  "the items that are expiring soon. Prefer meals that need 0-2 store items; assume common pantry " +
  "staples (salt, pepper, oil, water) are on hand. `usesFromPantry` must be items the user actually " +
  "has; `needFromStore` lists only the few extras. Each meal gets 3-6 short, practical steps. " +
  "Return JSON only.";

/** Bullet a (possibly empty) name list, or a dash when there's nothing. Keeps the prompt tidy. */
function listOrNone(names: string[]): string {
  return names.length ? names.map((n) => `- ${n}`).join("\n") : "- (none)";
}

function buildPrompt(input: GenerateMealsInput, guide: { maxMinutes: number; note: string }, count: number): string {
  const lines = [
    `Generate ${count} meal idea${count === 1 ? "" : "s"} I can make right now.`,
    "",
    "In my pantry (in stock):",
    listOrNone(input.pantry),
    "",
    "Use these FIRST (expiring soon):",
    listOrNone(input.expiring),
    "",
    `Energy level: ${input.energy} — ${guide.note} (aim for ≤ ${guide.maxMinutes} minutes).`,
  ];
  if (input.diets?.length) lines.push(`Dietary constraints (hard, every meal must comply): ${input.diets.join(", ")}.`);
  if (input.allergens?.length) lines.push(`Never include (allergens / excluded): ${input.allergens.join(", ")}.`);
  if (input.loves?.length) lines.push(`Favor when you can: ${input.loves.join(", ")}.`);
  if (input.dislikes?.length) lines.push(`Avoid if possible: ${input.dislikes.join(", ")}.`);
  lines.push("", "Prefer meals needing 0-2 store items.");
  return lines.join("\n");
}

/**
 * Generate meal ideas from the user's pantry via one cheap-tier structured call. The function is
 * intentionally focused: it clamps inputs (count 1..6; pantry/expiring capped to bound tokens), builds
 * the prompt, and returns the already-Zod-validated `meals`. It does NOT swallow errors — a bad key,
 * network failure, or schema mismatch throws, and the caller (the server action) degrades gracefully.
 */
export async function generateMeals(client: GeminiClient, input: GenerateMealsInput): Promise<GeneratedMeal[]> {
  const count = Math.min(6, Math.max(1, Math.round(input.count ?? 4)));
  // Cap the lists so a huge pantry can't blow the prompt budget (in-stock ~40, expiring ~15).
  const pantry = input.pantry.slice(0, 40);
  const expiring = input.expiring.slice(0, 15);
  const guide = energyGuide(input.energy);

  const parsed = await client.generateStructured(MealsSchema, buildPrompt({ ...input, pantry, expiring }, guide, count), {
    tier: "cheap",
    system: SYSTEM,
  });
  return parsed.meals;
}
