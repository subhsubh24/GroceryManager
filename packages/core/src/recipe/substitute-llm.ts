/**
 * LLM substitution fallback (PLAN §10) — the long tail beyond the curated table (substitute.ts).
 * Server-only (pulls @google/genai via the Gemini client), so it lives OUTSIDE the client-safe
 * @gm/core/recipe barrel and is reached via the "@gm/core/recipe/substitute-llm" subpath.
 */
import { z } from "zod";
import { getGeminiClient, type GeminiClient } from "../llm/client.js";
import { findSubstitutions, type Substitution } from "./substitute.js";

const SubsSchema = z.object({
  substitutions: z.array(z.object({ text: z.string(), uses: z.array(z.string()) })),
});

const SYSTEM =
  "Suggest 1-3 common cooking substitutions for the given ingredient. Each: a concise swap with " +
  "amounts/ratios a home cook can use right now (e.g. '1 cup milk + 1 tbsp lemon juice'). " +
  "`uses` lists the generic ingredient names the swap needs. Return JSON only.";

export interface SubstitutionResult {
  source: "known" | "ai" | "none";
  substitutions: Substitution[];
}

/** Static table first (instant, free); fall back to the LLM only for unknown ingredients. */
export async function getSubstitutions(
  ingredient: string,
  client: GeminiClient = getGeminiClient(),
): Promise<SubstitutionResult> {
  const known = findSubstitutions(ingredient);
  if (known.length) return { source: "known", substitutions: known };

  try {
    const res = await client.generateStructured(
      SubsSchema,
      `Ingredient: "${ingredient}". Suggest substitutions.`,
      { tier: "cheap", system: SYSTEM },
    );
    const subs = res.substitutions
      .map((s) => ({ text: s.text.trim(), uses: s.uses }))
      .filter((s) => s.text.length > 0);
    return subs.length ? { source: "ai", substitutions: subs } : { source: "none", substitutions: [] };
  } catch {
    return { source: "none", substitutions: [] };
  }
}
