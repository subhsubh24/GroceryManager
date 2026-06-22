/**
 * DB-backed NormalizationPorts (PLAN §5.4). Implements the deterministic stages with Drizzle:
 * override (corrections), UPC (products), trigram (`pg_trgm`), and optional embedding
 * (`pgvector` cosine) + LLM tiebreak when an embedder/resolver is injected.
 */
import { and, eq, sql } from "drizzle-orm";
import type { Querier } from "@gm/db";
import { canonicalItems, ingredientMatchOverrides, products, unitsOfMeasure } from "@gm/db";
import { estimateShelfLife } from "../pantry/shelf-life.js";
import type { CanonicalCandidate, NormalizationPorts } from "./normalize.js";

export interface DbPortsDeps {
  /** Embed a name to a 1536-d vector (e.g. gemini-embedding-001). Omit to skip embedding stage. */
  embed?: (text: string) => Promise<number[]>;
  /** LLM tiebreak/create. Omit to skip the LLM stage (everything below threshold → review). */
  llm?: (
    name: string,
    candidates: CanonicalCandidate[],
  ) => Promise<{ canonicalItemId: string | null; createName: string | null; confidence: number }>;
}

type Row = { id: string; name: string; score: number };

function toCandidates(res: unknown): CanonicalCandidate[] {
  return (res as Row[]).map((r) => ({ id: r.id, name: r.name, score: Number(r.score) }));
}

export function createDbNormalizationPorts(
  db: Querier,
  userId: string,
  deps: DbPortsDeps = {},
): NormalizationPorts {
  return {
    async findOverride(rawText, upc) {
      if (!rawText && !upc) return null;
      const where = rawText
        ? and(eq(ingredientMatchOverrides.userId, userId), eq(ingredientMatchOverrides.rawText, rawText))
        : and(eq(ingredientMatchOverrides.userId, userId), eq(ingredientMatchOverrides.upc, upc!));
      const rows = await db
        .select({ id: ingredientMatchOverrides.canonicalItemId })
        .from(ingredientMatchOverrides)
        .where(where)
        .limit(1);
      return rows[0]?.id ?? null;
    },

    async findByUpc(upc) {
      const rows = await db
        .select({ id: products.canonicalItemId })
        .from(products)
        .where(eq(products.upc, upc))
        .limit(1);
      return rows[0]?.id ?? null;
    },

    async trigramCandidates(name, limit) {
      const res = await db.execute(
        sql`SELECT id, name, similarity(name, ${name}) AS score
            FROM canonical_items
            WHERE name % ${name}
            ORDER BY score DESC
            LIMIT ${limit}`,
      );
      return toCandidates(res);
    },

    async embeddingCandidates(name, limit) {
      if (!deps.embed) return [];
      const vec = await deps.embed(name);
      const lit = `[${vec.join(",")}]`;
      const res = await db.execute(
        sql`SELECT id, name, 1 - (embedding <=> ${lit}::vector) AS score
            FROM canonical_items
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> ${lit}::vector
            LIMIT ${limit}`,
      );
      return toCandidates(res);
    },

    async llmResolve(name, candidates) {
      if (!deps.llm) return { canonicalItemId: null, createName: null, confidence: 0 };
      return deps.llm(name, candidates);
    },

    async createCanonical(name) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const unit = await db
        .select({ id: unitsOfMeasure.id })
        .from(unitsOfMeasure)
        .where(eq(unitsOfMeasure.code, "each"))
        .limit(1);
      const baseUnitId = unit[0]?.id;
      if (!baseUnitId) throw new Error("seed missing base unit 'each'");
      // Seed perishability + shelf life (+ the right domain) so the depletion engine's spoilage
      // ceiling works for never-seen items — otherwise a months-old backfilled perishable reads
      // "in stock" forever. Heuristic from the name; cached on the row (refine with an LLM later).
      const sl = estimateShelfLife(name);
      const rows = await db
        .insert(canonicalItems)
        .values({
          name,
          slug,
          baseUnitId,
          domain: sl.domain,
          perishability: sl.perishability,
          shelfLifeFridgeDays: sl.shelfLifeFridgeDays,
          shelfLifePantryDays: sl.shelfLifePantryDays,
        })
        .returning({ id: canonicalItems.id });
      return rows[0]!.id;
    },
  };
}
