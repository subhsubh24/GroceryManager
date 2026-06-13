-- Indexes Drizzle can't express directly (run after migrations). Idempotent.

-- Trigram GIN for fuzzy name/alias matching (PLAN §5.4 normalization cascade).
CREATE INDEX IF NOT EXISTS canonical_name_trgm
  ON canonical_items USING gin (name gin_trgm_ops);
-- array_to_string is only STABLE; wrap it in an IMMUTABLE function so it can index.
CREATE OR REPLACE FUNCTION gm_aliases_text(text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT array_to_string($1, ' ') $$;
CREATE INDEX IF NOT EXISTS canonical_aliases_trgm
  ON canonical_items USING gin (gm_aliases_text(aliases) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS product_displayname_trgm
  ON products USING gin (display_name gin_trgm_ops);

-- HNSW vector index for semantic match over 1536-d embeddings (cosine).
CREATE INDEX IF NOT EXISTS canonical_embedding_hnsw
  ON canonical_items USING hnsw (embedding vector_cosine_ops);
