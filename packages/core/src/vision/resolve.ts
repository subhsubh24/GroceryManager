/**
 * Semantic pre-resolution for a vision scan (PLAN §5.4 cascade applied to detection labels).
 *
 * The detector returns free-text labels ("pop", "greek yog"). Before reconciling against the pantry,
 * we run each label through the normalization cascade (override → UPC → trigram → embedding → LLM)
 * so a label can match an EXISTING canonical even with no shared word — "pop" → your "soda". The
 * caller then decides: a confident (deterministic) match auto-confirms; a SEMANTIC match (embedding /
 * LLM) to a pantry item is surfaced as a "possible match" to ask about instead of guessing.
 *
 * Read-only (the cascade never writes — createCanonical is the caller's job), so each label resolves
 * in its OWN short tenant tx and they run in parallel. Best-effort: any failure resolves to null and
 * the caller falls back to reconcile's token matching.
 */
import { loadEnv } from "@gm/config/env";
import { getDb, withTenant } from "@gm/db";
import { createGeminiEmbedder, getGeminiClient } from "../llm/index.js";
import { createDbNormalizationPorts } from "../ingestion/db-ports.js";
import { createLlmNormalizer } from "../ingestion/llm-normalizer.js";
import { normalizeLineItem, type NormalizationResult } from "../ingestion/normalize.js";

export interface ResolvedLabel {
  canonicalItemId: string | null;
  method: NormalizationResult["method"];
}

/** Cross-wording matches come from the fuzzy stages — treat these as "ask", not "auto-confirm". */
export const isSemanticMethod = (m: NormalizationResult["method"]): boolean =>
  m === "embedding" || m === "llm";

/** Resolve each distinct label → existing canonical via the cascade. Returns a map keyed by label. */
export async function resolveScanLabels(
  userId: string,
  labels: string[],
): Promise<Map<string, ResolvedLabel>> {
  const env = loadEnv();
  const ai = env.GEMINI_API_KEY || env.GOOGLE_VERTEX_PROJECT ? getGeminiClient() : null;
  // Stateless HTTP clients — build once, reuse across the parallel lookups.
  const deps = ai ? { embed: createGeminiEmbedder(ai), llm: createLlmNormalizer(ai) } : undefined;

  const out = new Map<string, ResolvedLabel>();
  await Promise.all(
    [...new Set(labels)].map(async (label) => {
      try {
        const norm = await withTenant(getDb(), userId, async (tx) => {
          const ports = createDbNormalizationPorts(tx, userId, deps);
          return normalizeLineItem({ rawText: label, name: label, upc: null }, ports);
        });
        out.set(label, { canonicalItemId: norm.canonicalItemId, method: norm.method });
      } catch {
        out.set(label, { canonicalItemId: null, method: "manual" });
      }
    }),
  );
  return out;
}
