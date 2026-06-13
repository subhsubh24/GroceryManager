/**
 * Ingredient normalization cascade (PLAN §5.4) — resolve a messy receipt line to a
 * `CanonicalItem`, stopping at the first confident hit:
 *   1. override  2. upc  3. trigram  4. embedding  5. llm tiebreak/create  6. needs-review
 *
 * The deterministic stages (override/upc/trigram) and the model stages (embedding/llm) are
 * behind an injectable `NormalizationPorts` interface, so the *cascade ordering + thresholds*
 * are pure and unit-testable with a fake. The DB/LLM adapters implement the ports.
 */
import { MATCH_CONFIDENCE, NORMALIZE } from "@gm/config/constants";
import type { MatchMethod } from "@gm/shared";

export interface CanonicalCandidate {
  id: string;
  name: string;
  /** Similarity score in 0..1 (trigram similarity or embedding cosine). */
  score: number;
}

export interface NormalizationPorts {
  findOverride(rawText: string | null, upc: string | null): Promise<string | null>;
  findByUpc(upc: string): Promise<string | null>;
  trigramCandidates(name: string, limit: number): Promise<CanonicalCandidate[]>;
  embeddingCandidates(name: string, limit: number): Promise<CanonicalCandidate[]>;
  /** LLM tiebreak: pick a candidate id, or propose a brand-new canonical name. */
  llmResolve(
    name: string,
    candidates: CanonicalCandidate[],
  ): Promise<{ canonicalItemId: string | null; createName: string | null; confidence: number }>;
  /** Create a new canonical item; returns its id. */
  createCanonical(name: string): Promise<string>;
}

export interface NormalizationInput {
  rawText: string;
  name: string; // cleaned product name
  upc: string | null;
}

export interface NormalizationResult {
  canonicalItemId: string | null;
  method: MatchMethod;
  confidence: number;
  needsReview: boolean;
}

export async function normalizeLineItem(
  input: NormalizationInput,
  ports: NormalizationPorts,
): Promise<NormalizationResult> {
  // 1. Override — a prior user correction wins outright.
  const override = await ports.findOverride(input.rawText, input.upc);
  if (override) {
    return { canonicalItemId: override, method: "override", confidence: MATCH_CONFIDENCE.override, needsReview: false };
  }

  // 2. UPC — exact SKU match.
  if (input.upc) {
    const byUpc = await ports.findByUpc(input.upc);
    if (byUpc) {
      return { canonicalItemId: byUpc, method: "upc", confidence: MATCH_CONFIDENCE.upc, needsReview: false };
    }
  }

  // 3. Trigram — fuzzy name match.
  const trigram = await ports.trigramCandidates(input.name, NORMALIZE.candidateLimit);
  const bestTrigram = trigram[0];
  if (bestTrigram && bestTrigram.score >= NORMALIZE.trigramThreshold) {
    return { canonicalItemId: bestTrigram.id, method: "trigram", confidence: bestTrigram.score, needsReview: false };
  }

  // 4. Embedding — semantic match.
  const embedding = await ports.embeddingCandidates(input.name, NORMALIZE.candidateLimit);
  const bestEmbedding = embedding[0];
  if (bestEmbedding && bestEmbedding.score >= NORMALIZE.embeddingCosineThreshold) {
    return { canonicalItemId: bestEmbedding.id, method: "embedding", confidence: bestEmbedding.score, needsReview: false };
  }

  // 5. LLM tiebreak/create over the union of fuzzy + semantic candidates.
  const candidates = dedupeById([...trigram, ...embedding]);
  const resolved = await ports.llmResolve(input.name, candidates);
  if (resolved.canonicalItemId && resolved.confidence >= NORMALIZE.llmAcceptThreshold) {
    return { canonicalItemId: resolved.canonicalItemId, method: "llm", confidence: resolved.confidence, needsReview: false };
  }
  if (resolved.createName && resolved.confidence >= NORMALIZE.llmAcceptThreshold) {
    const created = await ports.createCanonical(resolved.createName);
    return { canonicalItemId: created, method: "llm", confidence: resolved.confidence, needsReview: false };
  }

  // 6. Give up → Review inbox (never silently mutate the pantry).
  return {
    canonicalItemId: resolved.canonicalItemId ?? bestTrigram?.id ?? bestEmbedding?.id ?? null,
    method: "llm",
    confidence: resolved.confidence,
    needsReview: true,
  };
}

function dedupeById(list: CanonicalCandidate[]): CanonicalCandidate[] {
  const seen = new Map<string, CanonicalCandidate>();
  for (const c of list) {
    const prev = seen.get(c.id);
    if (!prev || c.score > prev.score) seen.set(c.id, c);
  }
  return [...seen.values()].sort((a, b) => b.score - a.score);
}
