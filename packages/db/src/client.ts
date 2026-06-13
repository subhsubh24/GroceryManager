import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { loadEnv } from "@gm/config/env";
import * as schema from "./schema.js";

/** Create a Drizzle client for a given connection string (useful for scripts/tests). */
export function createDb(url: string, max = 10) {
  // Supabase/pgbouncer transaction pooler (port 6543) doesn't support prepared statements.
  const pooled = /pooler\.supabase\.com|[:.]6543\b|pgbouncer=true/.test(url);
  const client = pooled ? postgres(url, { max, prepare: false }) : postgres(url, { max });
  return { db: drizzle(client, { schema }), client };
}

let _db: ReturnType<typeof createDb>["db"] | null = null;

/** Process-wide singleton Drizzle client, configured from env. */
export function getDb() {
  if (!_db) {
    const env = loadEnv();
    _db = createDb(env.DATABASE_URL).db;
  }
  return _db;
}

export type DB = ReturnType<typeof getDb>;
