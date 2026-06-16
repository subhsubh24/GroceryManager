/**
 * Recipe Remix LLM enrichment (additive feature) — the long tail beyond the curated table
 * (remix.ts). Server-only (pulls @google/genai via the Gemini client), so it lives OUTSIDE the
 * client-safe @gm/core/recipe barrel and is reached via the "@gm/core/recipe/remix-llm" subpath.
 *
 * Keyless-first: `suggestRemix` runs the deterministic table first and only *enriches/extends* it
 * with the LLM when a `generate` step is injected (mirrors planWeek's deps/escalation shape and
 * substitute-llm's client usage). LLM output is verified — especially for vegan, where a swap must
 * never reintroduce an animal product — and on verify-fail or no key we return the table result.
 */
import { z } from "zod";
import { getGeminiClient, type GeminiClient } from "../llm/client.js";
import {
  remixFromTable,
  type RemixAxis,
  type RemixResult,
  type RemixSwap,
} from "./remix.js";

/** The structured payload the LLM returns: swaps + a one-line note. */
const RemixSchema = z.object({
  swaps: z.array(
    z.object({
      original: z.string(),
      replacement: z.string(),
      reason: z.string(),
    }),
  ),
  note: z.string(),
});

export type RemixDraft = z.infer<typeof RemixSchema>;

export type RemixVerdict = { ok: true } | { ok: false; reason: string };

export interface RemixGenerateRequest {
  system: string;
  prompt: string;
  verify: (draft: RemixDraft) => RemixVerdict;
}

/** The injected LLM step — geminiRemix() in prod, a fake in tests. */
export type RemixGenerator = (req: RemixGenerateRequest) => Promise<RemixDraft>;

export interface RemixInput {
  ingredients: string[];
  axis: RemixAxis;
  title?: string;
}

// Animal-product keywords a vegan replacement must not contain (unless prefixed "vegan"/"plant").
const ANIMAL_KEYWORDS = [
  "meat", "chicken", "beef", "pork", "bacon", "fish", "shrimp", "milk", "cheese",
  "butter", "egg", "honey", "cream", "yogurt", "gelatin", "lard",
];

// A plant qualifier immediately before an animal keyword makes it vegan: "vegan"/"plant(-based)"
// and common plant *sources* of dairy/egg alternatives (oat/almond/coconut/flax/…). This is what
// keeps legit swaps like "oat milk", "coconut cream", "flax egg", "coconut bacon" from being flagged
// while still catching the real leaks ("buttermilk", "clarified butter", "chicken fat", bare "cream").
const PLANT_QUALIFIER_RE =
  /\b(?:vegan|plant|oat|almond|soy|soya|coconut|cashew|rice|hemp|pea|peanut|flax|chia|walnut|macadamia|sunflower|hazelnut|nut)(?:[\s-]based)?[\s-]*$/;

/**
 * True if `replacement` reintroduces an animal product on the vegan axis. An animal keyword is
 * allowed only when a plant qualifier sits immediately before it (e.g. "vegan butter", "oat milk",
 * "coconut cream", "flax egg"); a bare or animal-qualified keyword ("cream", "buttermilk") leaks.
 */
export function reintroducesAnimalProduct(replacement: string): boolean {
  const r = replacement.toLowerCase();
  return ANIMAL_KEYWORDS.some((kw) => {
    let idx = r.indexOf(kw);
    while (idx !== -1) {
      const before = r.slice(0, idx);
      if (!PLANT_QUALIFIER_RE.test(before)) return true;
      idx = r.indexOf(kw, idx + kw.length);
    }
    return false;
  });
}

/** Verify an LLM remix draft. For vegan, no replacement may reintroduce an animal product. */
export function verifyRemixDraft(draft: RemixDraft, axis: RemixAxis): RemixVerdict {
  if (axis === "vegan") {
    const bad = draft.swaps.find((s) => reintroducesAnimalProduct(s.replacement));
    if (bad) {
      return { ok: false, reason: `vegan replacement reintroduces an animal product: "${bad.replacement}"` };
    }
  }
  return { ok: true };
}

const SYSTEM_BY_AXIS: Record<RemixAxis, string> = {
  vegan:
    "You remix a recipe to be fully VEGAN. For each animal-product ingredient, give a plant-based " +
    "swap. NEVER let a replacement contain meat, chicken, beef, pork, fish, shrimp, milk, cheese, " +
    "butter, egg, honey, cream, yogurt, or gelatin (unless prefixed 'vegan' or 'plant').",
  healthier:
    "You remix a recipe to be HEALTHIER — trade refined, high-fat, or high-sugar items for " +
    "whole-food, lighter alternatives without making it bland.",
  cheaper:
    "You remix a recipe to be CHEAPER — replace pricey ingredients with budget-friendly swaps that " +
    "keep the dish recognizable.",
  faster:
    "You remix a recipe to be FASTER — favor pantry staples and ready-made shortcuts that cut prep " +
    "and cook time.",
};

const SYSTEM_TAIL =
  " Only swap ingredients that actually appear in the recipe; never invent ingredients the recipe " +
  "doesn't use. Each swap: { original, replacement, reason } where `reason` is one short, practical " +
  "sentence. Add a one-line `note` summarizing the remix. Return JSON only.";

function remixSystem(axis: RemixAxis): string {
  return SYSTEM_BY_AXIS[axis] + SYSTEM_TAIL;
}

function remixPrompt(input: RemixInput): string {
  const lines = [`Remix this recipe to be ${input.axis}.`];
  if (input.title) lines.push(`Title: ${input.title}.`);
  lines.push("", "Ingredients:");
  for (const ing of input.ingredients) lines.push(`- ${ing}`);
  return lines.join("\n");
}

/**
 * Wires the GeminiClient into a RemixGenerator (mirrors geminiPlanGenerator). Starts at the cheap
 * tier and escalates via the verify-then-escalate loop if verification keeps failing.
 */
export function geminiRemix(client: GeminiClient = getGeminiClient()): RemixGenerator {
  return async (req) => {
    const { value } = await client.generateWithVerify({
      schema: RemixSchema,
      system: req.system,
      prompt: req.prompt,
      tier: "cheap",
      verify: req.verify,
      maxAttempts: 3,
    });
    return value;
  };
}

/** Merge LLM swaps into the table swaps, deduped by `original` (table swaps win — they're verified). */
function mergeSwaps(tableSwaps: RemixSwap[], llmSwaps: RemixSwap[]): RemixSwap[] {
  const norm = (s: string) => s.toLowerCase().trim();
  const seen = new Set(tableSwaps.map((s) => norm(s.original)));
  const merged = [...tableSwaps];
  for (const s of llmSwaps) {
    const original = s.original.trim();
    const replacement = s.replacement.trim();
    if (!original || !replacement) continue;
    const key = norm(original);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ original, replacement, reason: s.reason.trim() });
  }
  return merged;
}

/**
 * Keyless-first remix: deterministic table floor, optionally enriched/extended by the LLM.
 *
 * Runs `remixFromTable` first. If `deps.generate` is provided, calls it to enrich (the verifier in
 * the request blocks vegan animal-product leaks); on success the LLM swaps are merged onto the table
 * swaps and `source` becomes "llm". On verify-fail, any error, or no `generate`, the deterministic
 * table result is returned unchanged.
 */
export async function suggestRemix(
  deps: { generate?: RemixGenerator },
  input: RemixInput,
): Promise<RemixResult> {
  const base = remixFromTable(input.ingredients, input.axis);

  if (deps.generate && input.ingredients.length > 0) {
    try {
      const draft = await deps.generate({
        system: remixSystem(input.axis),
        prompt: remixPrompt(input),
        verify: (d) => verifyRemixDraft(d, input.axis),
      });
      // Belt-and-suspenders: re-verify here too (the call that wrote it doesn't grade it).
      const verdict = verifyRemixDraft(draft, input.axis);
      if (verdict.ok) {
        const swaps = mergeSwaps(base.swaps, draft.swaps);
        const note = draft.note.trim() || base.note;
        return { axis: input.axis, source: "llm", swaps, note };
      }
    } catch {
      // Best-effort LLM path — drop to the deterministic floor on any failure
      // (no key, expired key, network, or verify-then-escalate exhausted).
    }
  }

  return base;
}
