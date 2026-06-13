import { sql } from "drizzle-orm";
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

/**
 * Process-wide runtime client. For RLS to bite this MUST connect as a restricted, non-owner role
 * (a member of `grocery_app`) — see sql/0002_rls.sql + .env.example.
 */
export function getDb() {
  if (!_db) {
    const env = loadEnv();
    _db = createDb(env.DATABASE_URL).db;
  }
  return _db;
}

let _adminDb: ReturnType<typeof createDb>["db"] | null = null;

/**
 * Owner/superuser client for **provisioning + bootstrap only** (creating users, the demo
 * `getLatestUserId` lookup, cross-tenant worker iteration). Bypasses RLS, so never use it for
 * per-tenant data access — that goes through `getDb()` + `withTenant`.
 */
export function getAdminDb() {
  if (!_adminDb) {
    const env = loadEnv();
    _adminDb = createDb(env.DIRECT_DATABASE_URL ?? env.DATABASE_URL).db;
  }
  return _adminDb;
}

export type DB = ReturnType<typeof getDb>;
/** A Drizzle transaction handle — same query builder surface as DB. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
/** Anything you can run tenant-scoped queries on (the live DB or a transaction). */
export type Querier = DB | Tx;

/**
 * Run `fn` inside a transaction with `app.current_user_id` set for RLS (PLAN §11). The setting is
 * transaction-local (`set_config(..., true)`), so it's safe under the Supabase transaction pooler
 * and never leaks across pooled connections. Forgetting it → policies deny by default.
 */
export function withTenant<T>(db: DB, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}
