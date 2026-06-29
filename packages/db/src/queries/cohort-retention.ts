/**
 * H11 — Cohort-retention DATA SOURCE (privacy-safe AGGREGATES only).
 *
 * Computes weekly signup cohorts (anchored on users.created_at) and, for each cohort, the count of
 * users who showed ANY activity (meal_logs.cooked_at) in each of the 8 week-offsets after signup.
 *
 * HONESTY / PRIVACY BAR:
 * - Returns ONLY aggregates: { cohort_week, cohort_size, retained_counts[] }. No per-user rows, no
 *   ids, no PII — getAdminDb() bypasses RLS, so the SQL itself must never project a user identifier.
 * - Returns null gracefully when the source tables are absent (pre-migration) so the route degrades
 *   to an honest disconnected state instead of throwing.
 *
 * The shape returned matches `RawCohortRow` in @gm/core/growth/analytics (which the SURFACE builder
 * `buildCohortRetention` consumes) — keep them in sync. (@gm/db must NOT import @gm/core, so the
 * shape is re-declared here rather than imported.)
 */
import { sql } from "drizzle-orm";
import type { Querier } from "../client.js";

/** Number of week-offsets (0..7) of retention we compute per cohort. */
const RETENTION_WEEKS = 8;

/** Most-recent signup weeks to include (bounds the result + cost). */
const COHORT_WEEKS = 12;

/**
 * One aggregate cohort row. Mirrors `RawCohortRow` in @gm/core/growth/analytics.
 * `retained_counts[i]` = users from this cohort active in week-offset `i` (index 0 = signup week).
 */
export interface RawCohortRow {
  /** ISO week start (YYYY-MM-DD), Monday-anchored (date_trunc('week', …)). */
  cohort_week: string;
  /** Users who signed up in this week. */
  cohort_size: number;
  /** Retained counts per week-offset (index = offset, length RETENTION_WEEKS). */
  retained_counts: (number | null)[];
}

/** Raw row shape postgres returns for the cohort aggregate (text counts, int[] array). */
export interface CohortSqlRow {
  cohort_week: string;
  cohort_size: string;
  /** int[] from postgres — array of the 8 retained counts. */
  retained_counts: (number | null)[] | null;
}

/**
 * Pure transform: postgres rows → `RawCohortRow[]`. Factored out so it's unit-testable without a
 * live DB. Coerces the text cohort_size to a number and normalizes the int[] retained_counts.
 */
export function shapeCohortRows(rows: CohortSqlRow[]): RawCohortRow[] {
  return rows.map((r) => ({
    cohort_week: r.cohort_week,
    cohort_size: parseInt(r.cohort_size ?? "0", 10),
    // postgres returns int[]; coerce each element to a finite number, default 0.
    retained_counts: (r.retained_counts ?? []).map((c) => (c == null ? 0 : Number(c))),
  }));
}

/**
 * Compute weekly signup cohorts + per-week-offset retention counts, server-side, in a single query.
 *
 * Activity signal: a user is "retained in week-offset N" iff they have ANY meal_logs.cooked_at whose
 * week (date_trunc('week', cooked_at)) equals their cohort week + N weeks. Offset 0 is the signup
 * week itself, so retained_counts[0] is how many of the cohort cooked during their signup week.
 *
 * Returns null if `users` or `meal_logs` don't exist yet (pre-migration) — the only graceful case.
 * Returns [] when there are simply no cohorts. Admin/aggregate — no per-user rows ever leave the DB.
 */
export async function getCohortRetention(db: Querier): Promise<RawCohortRow[] | null> {
  try {
    const rows = (await db.execute(sql`
      WITH cohorts AS (
        -- One row per user: their Monday-anchored signup week. Bounded to the most recent
        -- COHORT_WEEKS signup weeks so the cross product with activity stays small.
        SELECT u.id AS user_id, date_trunc('week', u.created_at) AS cohort_week
        FROM users u
        WHERE u.created_at >= date_trunc('week', now()) - (${COHORT_WEEKS - 1} * interval '1 week')
      ),
      -- Distinct (user, active_week) so a user counts once per week regardless of how many meals.
      activity AS (
        SELECT DISTINCT m.user_id, date_trunc('week', m.cooked_at) AS active_week
        FROM meal_logs m
        WHERE m.user_id IN (SELECT user_id FROM cohorts)
      ),
      -- For each cohort user × each offset 0..RETENTION_WEEKS-1, did they have activity that week?
      offsets AS (
        SELECT generate_series(0, ${RETENTION_WEEKS - 1}) AS week_offset
      ),
      retained AS (
        SELECT
          c.cohort_week,
          o.week_offset,
          count(DISTINCT a.user_id) AS retained
        FROM cohorts c
        CROSS JOIN offsets o
        LEFT JOIN activity a
          ON a.user_id = c.user_id
         AND a.active_week = c.cohort_week + (o.week_offset * interval '1 week')
        GROUP BY c.cohort_week, o.week_offset
      ),
      sizes AS (
        SELECT cohort_week, count(*) AS cohort_size
        FROM cohorts
        GROUP BY cohort_week
      )
      SELECT
        to_char(s.cohort_week, 'YYYY-MM-DD') AS cohort_week,
        s.cohort_size::text AS cohort_size,
        array_agg(r.retained ORDER BY r.week_offset)::int[] AS retained_counts
      FROM sizes s
      JOIN retained r ON r.cohort_week = s.cohort_week
      GROUP BY s.cohort_week, s.cohort_size
      ORDER BY s.cohort_week ASC
    `)) as unknown as CohortSqlRow[];

    return shapeCohortRows(rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Pre-migration / fresh DB: the source tables aren't there yet → honest null (disconnected).
    if (
      (msg.includes("users") || msg.includes("meal_logs")) &&
      msg.includes("does not exist")
    ) {
      return null;
    }
    throw err;
  }
}
