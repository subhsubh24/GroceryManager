-- Required Postgres extensions (run before Drizzle migrations).
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy ingredient/product name matching
CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector: semantic embedding matching
