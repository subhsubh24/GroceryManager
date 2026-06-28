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
    // getAdminDb MUST be the OWNER connection (bypasses RLS): it provisions users at signup and does
    // the username lookup at signin, neither of which has a tenant session to satisfy the `users` RLS
    // policy (`id = app_current_user_id()`). If DIRECT_DATABASE_URL is unset it silently falls back to
    // the RLS-restricted DATABASE_URL (the grocery_app role) — which makes BOTH signin and signup fail
    // (every users read/insert is denied) and no user row is ever created. That failure is invisible
    // (it surfaces only as a generic route error boundary), so flag it LOUDLY here. Fix: set
    // DIRECT_DATABASE_URL to the Supabase DIRECT/owner connection (port 5432, role `postgres`) — see
    // .env.example. (In production it should ALWAYS be set; DATABASE_URL is the restricted role.)
    if (!env.DIRECT_DATABASE_URL) {
      console.error(
        "[getAdminDb] DIRECT_DATABASE_URL is not set — admin/provisioning is falling back to the " +
          "RLS-restricted DATABASE_URL. Signin + signup WILL FAIL (the users RLS policy blocks " +
          "provisioning/lookup without a tenant session). Set DIRECT_DATABASE_URL to the owner " +
          "(direct, port 5432, role postgres) connection. See .env.example.",
      );
    }
    _adminDb = createDb(env.DIRECT_DATABASE_URL ?? env.DATABASE_URL).db;
  }
  return _adminDb;
}

export type DB = ReturnType<typeof getDb>;
/** A Drizzle transaction handle — same query builder surface as DB. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
/** Anything you can run tenant-scoped queries on (the live DB or a transaction). */
export type Querier = DB | Tx;

// The tenant id is set as the `app.current_user_id` GUC and RLS casts it to `uuid`. Guard here so a
// non-UUID id fails CLOSED with a clear error before any query runs — rather than a cryptic
// `invalid input syntax for type uuid` thrown deep inside the first RLS-checked statement. (Defense
// in depth: callers like `currentUserId()` already reject non-UUID sessions; this protects every
// other caller — cron, workers — too.) Regex inlined: `@gm/db` must not import `@gm/core`.
const TENANT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Run `fn` inside a transaction with `app.current_user_id` set for RLS (PLAN §11). The setting is
 * transaction-local (`set_config(..., true)`), so it's safe under the Supabase transaction pooler
 * and never leaks across pooled connections. Forgetting it → policies deny by default.
 */
export function withTenant<T>(db: DB, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!TENANT_UUID_RE.test(userId)) {
    throw new Error("withTenant: tenant userId must be a UUID (refusing to scope RLS to a non-UUID id)");
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}
