/**
 * Agentic onboarding (PLAN §8.7) — turn a short, friendly interview into typed PreferenceSignals
 * that project into the UserModel the planner + recipe ranking already read from. Two halves:
 *
 *   answersToSignals      — deterministic mapping of the curated structured questions → signals.
 *   parseFreeTextPreferences — the agentic bit: a cheap Gemini call extracts preferences from one
 *                              free-text answer ("I'm veggie, love Thai, hate cilantro") into the
 *                              SAME typed signal shape (semantic-layer discipline — fixed kinds).
 *
 * Both emit `PreferenceSignalInput`s; the caller appends them to the ledger (source "onboarding_q")
 * and re-projects. Onboarding is a strong-but-not-absolute signal, so confidences sit above passive
 * behavior signals (cooked/skip) yet below hard allergens.
 */
import { z } from "zod";
import type { GeminiClient } from "../llm/client.js";
import type { PreferenceSignalInput } from "./user-model.js";

export interface OnboardingAnswers {
  diets?: string[];
  allergens?: string[];
  lovedCuisines?: string[];
  dislikedCuisines?: string[];
  lovedIngredients?: string[];
  dislikedIngredients?: string[];
  qualityPrefs?: string[];
  freeText?: string | null;
}

const ONBOARDING_CONF = {
  diet: 0.9,
  allergen: 0.95,
  cuisine: 0.6,
  ingredient: 0.6,
  quality: 0.7,
} as const;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const key = (s: string) => s.toLowerCase().trim();
const clean = (xs: string[] | undefined) => (xs ?? []).map(key).filter(Boolean);

/** Deterministic: the curated structured answers → typed preference signals. */
export function answersToSignals(a: OnboardingAnswers): PreferenceSignalInput[] {
  const out: PreferenceSignalInput[] = [];
  const push = (kind: keyof typeof ONBOARDING_CONF, k: string, polarity: "positive" | "negative") =>
    out.push({ topic: `${kind}:${k}`, value: k, polarity, confidence: ONBOARDING_CONF[kind] });

  for (const d of clean(a.diets)) push("diet", d, "positive");
  for (const al of clean(a.allergens)) push("allergen", al, "positive");
  for (const c of clean(a.lovedCuisines)) push("cuisine", c, "positive");
  for (const c of clean(a.dislikedCuisines)) push("cuisine", c, "negative");
  for (const i of clean(a.lovedIngredients)) push("ingredient", i, "positive");
  for (const i of clean(a.dislikedIngredients)) push("ingredient", i, "negative");
  for (const q of clean(a.qualityPrefs)) push("quality", q, "positive");

  return dedupe(out);
}

const FreeTextSchema = z.object({
  signals: z.array(
    z.object({
      kind: z.enum(["diet", "allergen", "cuisine", "ingredient", "quality"]),
      key: z.string(),
      polarity: z.enum(["positive", "negative"]),
      confidence: z.number(),
    }),
  ),
});

const FREE_TEXT_SYSTEM =
  "Extract food & grocery preferences from the user's message into typed signals. " +
  "kind ∈ diet|allergen|cuisine|ingredient|quality. key is a short, generic lowercase term " +
  "(e.g. 'vegetarian','peanut','thai','cilantro','organic') — no brands or sentences. " +
  "polarity: use 'positive' when the preference APPLIES to the user — a diet they follow, an " +
  "allergen they have/react to, a quality they prefer, or a cuisine/ingredient they LIKE. " +
  "Use 'negative' ONLY for a cuisine or ingredient they dislike. (An allergy is always positive.) " +
  "Only include clear preferences. Return JSON only.";

/** Agentic: parse one free-text answer into the same typed signal shape via a cheap Gemini call. */
export async function parseFreeTextPreferences(
  client: GeminiClient,
  text: string | null | undefined,
): Promise<PreferenceSignalInput[]> {
  if (!text || !text.trim()) return [];
  try {
    const res = await client.generateStructured(
      FreeTextSchema,
      `Message: "${text.trim()}"\n\nExtract the preferences.`,
      { tier: "cheap", system: FREE_TEXT_SYSTEM },
    );
    const out = res.signals
      .map((s) => ({ ...s, key: key(s.key) }))
      .filter((s) => s.key.length > 0)
      .map((s) => ({
        topic: `${s.kind}:${s.key}`,
        value: s.key,
        polarity: s.polarity,
        confidence: clamp01(s.confidence),
      }));
    return dedupe(out);
  } catch {
    return []; // best-effort — the structured answers still seed the model
  }
}

/** Keep the strongest signal per (topic, polarity). */
function dedupe(signals: PreferenceSignalInput[]): PreferenceSignalInput[] {
  const best = new Map<string, PreferenceSignalInput>();
  for (const s of signals) {
    const k = `${s.topic}|${s.polarity}`;
    const prev = best.get(k);
    if (!prev || s.confidence > prev.confidence) best.set(k, s);
  }
  return [...best.values()];
}
