/**
 * LLM normalization tiebreak (PLAN §5.4 step 5 / §5.5) — the cascade's final, model-backed stage.
 * When override/UPC/trigram/embedding don't confidently resolve a messy line, the cheapest Gemini
 * tier picks the right canonical from the *retrieved candidates only* (semantic-layer discipline,
 * §8.2) or proposes a clean new canonical name. A deterministic verifier rejects hallucinated ids
 * and forces a match-or-propose, escalating Flash-Lite → Flash on failure (§8.4).
 *
 * Returns the `NormalizationPorts.llmResolve` shape, so it drops into `createDbNormalizationPorts`
 * via `{ llm }` with no cascade changes. On exhaustion it returns confidence 0 → the cascade routes
 * the line to the Review inbox (never a silent bad match).
 */
import { z } from "zod";
import type { GeminiClient } from "../llm/client.js";
import type { CanonicalCandidate } from "./normalize.js";

const ResolveSchema = z.object({
  matchId: z.string().nullable(),
  createName: z.string().nullable(),
  confidence: z.number(),
});

const SYSTEM =
  "You map a messy grocery/household product name to a canonical food item. You are given " +
  "candidate canonical items (id + name). If one candidate is the SAME underlying food, return " +
  "its exact id as matchId. If none match, set matchId null and propose a short, generic " +
  "createName (e.g. 'olive oil', 'whole milk', 'roma tomato') — no brand, size, or packaging. " +
  "confidence is 0..1. Never invent an id that isn't listed.";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export type LlmNormalizer = (
  name: string,
  candidates: CanonicalCandidate[],
) => Promise<{ canonicalItemId: string | null; createName: string | null; confidence: number }>;

export function createLlmNormalizer(client: GeminiClient): LlmNormalizer {
  return async (name, candidates) => {
    const ids = new Set(candidates.map((c) => c.id));
    const list = candidates.length
      ? candidates.map((c) => `- id=${c.id} name="${c.name}" (sim ${c.score.toFixed(2)})`).join("\n")
      : "(no candidates)";
    const prompt =
      `Product to map: "${name}"\n\nCandidates:\n${list}\n\n` +
      "Return matchId (one of the listed ids) if one is the same food, else a createName.";

    try {
      const { value } = await client.generateWithVerify({
        schema: ResolveSchema,
        prompt,
        system: SYSTEM,
        tier: "cheap",
        maxAttempts: 3,
        verify: (v) => {
          if (v.matchId && !ids.has(v.matchId)) {
            return { ok: false, reason: `matchId ${v.matchId} is not one of the candidates` };
          }
          if (!v.matchId && !(v.createName && v.createName.trim())) {
            return { ok: false, reason: "must return a matchId or a non-empty createName" };
          }
          return { ok: true };
        },
      });

      // Belt-and-suspenders: never trust an id the verifier somehow let through.
      const canonicalItemId = value.matchId && ids.has(value.matchId) ? value.matchId : null;
      const createName = canonicalItemId ? null : value.createName?.trim() || null;
      return { canonicalItemId, createName, confidence: clamp01(value.confidence) };
    } catch {
      // verify-then-escalate exhausted → defer to the Review inbox.
      return { canonicalItemId: null, createName: null, confidence: 0 };
    }
  };
}
