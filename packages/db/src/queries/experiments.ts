/**
 * H10 — Experiment exposure + conversion logging, and admin aggregate reads.
 *
 * `experiment_exposures` and `experiment_conversions` are created by migration 0017.
 * All per-user writes run inside `withTenant` so they satisfy the RLS WITH CHECK.
 * Aggregate reads (getExperimentStats) use getAdminDb() — RLS-bypass is intentional
 * and safe: this is a server-only admin/cron endpoint that returns only aggregate counts.
 *
 * postgres.js RowList IS the array — no `.rows` accessor needed.
 */
import { sql } from "drizzle-orm";
import type { Querier } from "../client.js";

// ---------------------------------------------------------------------------
// Per-user writes (call inside withTenant)
// ---------------------------------------------------------------------------

/**
 * Log that `userId` was exposed to `variant` of `experimentId`. Best-effort insert — if the
 * user has already been assigned this variant we still insert (exposure counts matter for
 * frequency; uniqueness is enforced by the UI/server helper calling this only once per session).
 * Callers catch + swallow errors so this never blocks the user.
 */
export async function logExposure(
  db: Querier,
  userId: string,
  experimentId: string,
  variant: string,
): Promise<void> {
  await db.execute(
    sql`INSERT INTO experiment_exposures (user_id, experiment_id, variant)
        VALUES (${userId}, ${experimentId}, ${variant})`,
  );
}

/**
 * Log that `userId` triggered `eventName` for `experimentId` (a conversion signal).
 * Best-effort — callers catch + swallow errors. Multiple conversion rows per user are allowed
 * (the aggregate query deduplicates to one per user when counting unique conversions).
 */
export async function logConversion(
  db: Querier,
  userId: string,
  experimentId: string,
  eventName: string,
): Promise<void> {
  await db.execute(
    sql`INSERT INTO experiment_conversions (user_id, experiment_id, event_name)
        VALUES (${userId}, ${experimentId}, ${eventName})`,
  );
}

// ---------------------------------------------------------------------------
// Admin aggregate read
// ---------------------------------------------------------------------------

export interface VariantStats {
  /** Distinct users exposed to this variant. */
  exposed: number;
  /** Distinct users who converted (at least once, for the experiment's primaryEvent). */
  conversions: number;
}

/**
 * Aggregate exposure + conversion counts for an experiment, grouped by variant.
 *
 * Admin/cross-tenant — only ever called from the growth snapshot/analytics route with
 * `getAdminDb()`. Returns an empty Record when the tables don't exist yet (pre-migration 0017).
 *
 * @param primaryEvent  The conversion event to count (e.g. "waitlist_signup").
 */
export async function getExperimentStats(
  db: Querier,
  experimentId: string,
  primaryEvent: string,
): Promise<Record<string, VariantStats>> {
  try {
    // Exposed: distinct users per variant.
    const exposedRows = (await db.execute(
      sql`SELECT variant, count(DISTINCT user_id)::text AS n
          FROM experiment_exposures
          WHERE experiment_id = ${experimentId}
          GROUP BY variant`,
    )) as unknown as Array<{ variant: string; n: string }>;

    // Converted: distinct users who converted on the primaryEvent for this experiment.
    const convRows = (await db.execute(
      sql`SELECT e.variant, count(DISTINCT c.user_id)::text AS n
          FROM experiment_exposures e
          JOIN experiment_conversions c
            ON c.user_id = e.user_id AND c.experiment_id = e.experiment_id
          WHERE e.experiment_id = ${experimentId}
            AND c.event_name = ${primaryEvent}
          GROUP BY e.variant`,
    )) as unknown as Array<{ variant: string; n: string }>;

    const result: Record<string, VariantStats> = {};
    for (const r of exposedRows) {
      result[r.variant] = { exposed: parseInt(r.n ?? "0", 10), conversions: 0 };
    }
    for (const r of convRows) {
      const existing = result[r.variant];
      if (existing) {
        existing.conversions = parseInt(r.n ?? "0", 10);
      } else {
        result[r.variant] = { exposed: 0, conversions: parseInt(r.n ?? "0", 10) };
      }
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("experiment_exposures") && msg.includes("does not exist") ||
      msg.includes("experiment_conversions") && msg.includes("does not exist")
    ) {
      return {};
    }
    throw err;
  }
}
