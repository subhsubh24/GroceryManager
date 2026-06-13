import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { loadEnv } from "@gm/config/env";
import * as schema from "./schema.js";

/** Create a Drizzle client for a given connection string (useful for scripts/tests). */
export function createDb(url: string, max = 10) {
  const client = postgres(url, { max });
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
