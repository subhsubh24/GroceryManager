/**
 * Growth-agent query helpers: waitlist UTM attribution + content schedule.
 * These tables are created by raw SQL migrations (0012–0014) with no Drizzle schema,
 * so all queries use db.execute(sql`…`) to match the existing waitlist query pattern.
 */
import { sql } from "drizzle-orm";
import type { Querier } from "../client.js";

// ---------------------------------------------------------------------------
// Waitlist with UTM columns (migrations 0012 + 0013)
// ---------------------------------------------------------------------------

export interface WaitlistEntry {
  id: string;
  email: string;
  source: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer_url: string | null;
  created_at: Date;
}

/**
 * All waitlist submissions with UTM columns, newest first.
 * Returns null if the table doesn't exist yet (pre-migration 0012/0013 — safe on first deploy).
 */
export async function getWaitlistWithUtm(db: Querier): Promise<WaitlistEntry[] | null> {
  try {
    const rows = (await db.execute(
      sql`SELECT id, email, source, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer_url, created_at
          FROM waitlist_submissions
          ORDER BY created_at DESC`,
    )) as unknown as WaitlistEntry[];
    return rows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("waitlist_submissions") && msg.includes("does not exist")) return null;
    throw err;
  }
}

export interface UtmData {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referrerUrl?: string | null;
}

/**
 * Update UTM columns for an existing waitlist entry by email — for when UTM is captured
 * on a subsequent page view after the initial sign-up. No-ops if the email doesn't exist.
 */
export async function upsertWaitlistUtm(
  db: Querier,
  email: string,
  utmData: UtmData,
): Promise<void> {
  await db.execute(
    sql`UPDATE waitlist_submissions
        SET
          utm_source   = COALESCE(${utmData.utmSource ?? null}, utm_source),
          utm_medium   = COALESCE(${utmData.utmMedium ?? null}, utm_medium),
          utm_campaign = COALESCE(${utmData.utmCampaign ?? null}, utm_campaign),
          utm_content  = COALESCE(${utmData.utmContent ?? null}, utm_content),
          utm_term     = COALESCE(${utmData.utmTerm ?? null}, utm_term),
          referrer_url = COALESCE(${utmData.referrerUrl ?? null}, referrer_url)
        WHERE lower(email) = lower(${email})`,
  );
}

// ---------------------------------------------------------------------------
// Content schedule (migration 0014)
// ---------------------------------------------------------------------------

export interface ContentItem {
  id: string;
  channel: string;
  title: string;
  content: string;
  scheduled_at: Date;
  status: string;
  published_at: Date | null;
  error_msg: string | null;
  created_at: Date;
}

/**
 * Query content_schedule items, optionally filtered by status.
 * Ordered by scheduled_at ascending (soonest first).
 * Returns null if the table doesn't exist yet (pre-migration 0014).
 */
export async function getContentSchedule(
  db: Querier,
  status?: string,
): Promise<ContentItem[] | null> {
  try {
    const rows = (await db.execute(
      status != null
        ? sql`SELECT id, channel, title, content, scheduled_at, status, published_at, error_msg, created_at
              FROM content_schedule
              WHERE status = ${status}
              ORDER BY scheduled_at ASC`
        : sql`SELECT id, channel, title, content, scheduled_at, status, published_at, error_msg, created_at
              FROM content_schedule
              ORDER BY scheduled_at ASC`,
    )) as unknown as ContentItem[];
    return rows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("content_schedule") && msg.includes("does not exist")) return null;
    throw err;
  }
}

/** Mark a content item as published: set status='published' and published_at. */
export async function markContentPublished(
  db: Querier,
  id: string,
  publishedAt: Date,
): Promise<void> {
  await db.execute(
    sql`UPDATE content_schedule
        SET status = 'published', published_at = ${publishedAt}
        WHERE id = ${id}`,
  );
}

/** Mark a content item as skipped with an error message. */
export async function markContentSkipped(
  db: Querier,
  id: string,
  errorMsg: string,
): Promise<void> {
  await db.execute(
    sql`UPDATE content_schedule
        SET status = 'skipped', error_msg = ${errorMsg}
        WHERE id = ${id}`,
  );
}

// ---------------------------------------------------------------------------
// Waitlist double-opt-in (migration 0015) — H8
// ---------------------------------------------------------------------------

/**
 * Mark a waitlist signup as confirmed (double-opt-in). Idempotent: only sets
 * confirmed_at if not already set, so a double-clicked confirmation link is safe.
 * No-ops if the email isn't on the list. Returns false if the column doesn't
 * exist yet (pre-migration 0015 — safe on first deploy).
 */
export async function setWaitlistConfirmed(db: Querier, email: string): Promise<boolean> {
  try {
    await db.execute(
      sql`UPDATE waitlist_submissions
          SET confirmed_at = COALESCE(confirmed_at, now())
          WHERE lower(email) = lower(${email})`,
    );
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("confirmed_at") || (msg.includes("waitlist_submissions") && msg.includes("does not exist"))) {
      return false;
    }
    throw err;
  }
}

/**
 * Count confirmed (double-opt-in) waitlist signups. Returns 0 if the table/column
 * doesn't exist yet (pre-migration). Used by the growth snapshot for email list size.
 */
export async function getWaitlistConfirmedCount(db: Querier): Promise<number> {
  try {
    const rows = (await db.execute(
      sql`SELECT count(*)::text AS n
          FROM waitlist_submissions
          WHERE confirmed_at IS NOT NULL`,
    )) as unknown as Array<{ n: string }>;
    return parseInt(rows[0]?.n ?? "0", 10);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("confirmed_at") || (msg.includes("waitlist_submissions") && msg.includes("does not exist"))) {
      return 0;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Active subscriber stats (preference_signals ledger) — H7 snapshot
// ---------------------------------------------------------------------------

export interface ActiveSubscriberStats {
  /** Distinct users whose LATEST entitlement signal is premium. */
  active: number;
  /** Active-tier breakdown (latest subscription_tier per active user). */
  monthly: number;
  annual: number;
  family: number;
}

/**
 * Count active subscribers from the preference-signal ledger: a user is active iff their
 * most-recent `entitlement` signal value is `premium`. The tier mix uses each active
 * user's most-recent `subscription_tier` (defaulting to monthly when unrecorded).
 *
 * Reads via the admin DB (RLS-bypassing) — only ever called from an admin/cron-gated route.
 */
export async function getActiveSubscriberStats(db: Querier): Promise<ActiveSubscriberStats> {
  const rows = (await db.execute(
    sql`WITH latest_ent AS (
          SELECT DISTINCT ON (user_id) user_id, value
          FROM preference_signals
          WHERE topic = 'entitlement'
          ORDER BY user_id, occurred_at DESC
        ),
        latest_tier AS (
          SELECT DISTINCT ON (user_id) user_id, value
          FROM preference_signals
          WHERE topic = 'subscription_tier'
          ORDER BY user_id, occurred_at DESC
        )
        SELECT COALESCE(lt.value, 'premium_monthly') AS tier, count(*)::text AS n
        FROM latest_ent le
        LEFT JOIN latest_tier lt ON lt.user_id = le.user_id
        WHERE le.value = 'premium'
        GROUP BY COALESCE(lt.value, 'premium_monthly')`,
  )) as unknown as Array<{ tier: string; n: string }>;

  const stats: ActiveSubscriberStats = { active: 0, monthly: 0, annual: 0, family: 0 };
  for (const r of rows) {
    const n = parseInt(r.n ?? "0", 10);
    stats.active += n;
    if (r.tier === "premium_family") stats.family += n;
    else if (r.tier === "premium_annual") stats.annual += n;
    else stats.monthly += n;
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Analytics surface aggregate queries — H9
// ---------------------------------------------------------------------------

export interface WeeklyCountRow {
  /** ISO week start (YYYY-MM-DD). */
  week: string;
  count: number;
}

/**
 * Waitlist signups aggregated by ISO week (Monday-anchored), oldest first.
 * Returns null if the table doesn't exist yet (pre-migration 0012).
 * Admin/aggregate — only counts per week, no PII.
 */
export async function getWaitlistByWeek(db: Querier): Promise<WeeklyCountRow[] | null> {
  try {
    const rows = (await db.execute(
      sql`SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week,
                 count(*)::text AS n
          FROM waitlist_submissions
          GROUP BY date_trunc('week', created_at)
          ORDER BY date_trunc('week', created_at) ASC`,
    )) as unknown as Array<{ week: string; n: string }>;
    return rows.map((r) => ({ week: r.week, count: parseInt(r.n ?? "0", 10) }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("waitlist_submissions") && msg.includes("does not exist")) return null;
    throw err;
  }
}

/**
 * New active subscribers aggregated by ISO week, oldest first.
 * Counts the first `entitlement=premium` signal per user per week — NOT total active at that
 * point-in-time, which would require a harder running-total query and isn't needed by the agent.
 * Returns null if the preference_signals table is empty / no entitlement rows (safely returns []).
 * Admin/aggregate — counts only.
 */
export async function getSubscribersByWeek(db: Querier): Promise<WeeklyCountRow[] | null> {
  try {
    const rows = (await db.execute(
      sql`SELECT to_char(date_trunc('week', min_at), 'YYYY-MM-DD') AS week,
                 count(*)::text AS n
          FROM (
            SELECT user_id, min(occurred_at) AS min_at
            FROM preference_signals
            WHERE topic = 'entitlement' AND value = 'premium'
            GROUP BY user_id
          ) first_premium
          GROUP BY date_trunc('week', min_at)
          ORDER BY date_trunc('week', min_at) ASC`,
    )) as unknown as Array<{ week: string; n: string }>;
    return rows.map((r) => ({ week: r.week, count: parseInt(r.n ?? "0", 10) }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      (msg.includes("preference_signals") && msg.includes("does not exist")) ||
      (msg.includes("preference_signals") && msg.includes("does not exist"))
    ) {
      return null;
    }
    throw err;
  }
}

export interface SegmentCountRow {
  /** The utm_source value, or null for direct/organic traffic. */
  segment: string | null;
  count: number;
}

/**
 * Waitlist signup counts grouped by utm_source.
 * Returns null if the table doesn't exist yet (pre-migration 0012/0013).
 * Admin/aggregate — no PII (only the source label + count).
 */
export async function getWaitlistSegmentCounts(
  db: Querier,
): Promise<SegmentCountRow[] | null> {
  try {
    const rows = (await db.execute(
      sql`SELECT utm_source AS segment, count(*)::text AS n
          FROM waitlist_submissions
          GROUP BY utm_source
          ORDER BY count(*) DESC`,
    )) as unknown as Array<{ segment: string | null; n: string }>;
    return rows.map((r) => ({
      segment: r.segment ?? null,
      count: parseInt(r.n ?? "0", 10),
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("waitlist_submissions") && msg.includes("does not exist")) return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// §34 Part B — gated-beta INVITE CODES (migration 0021)
//
// Admin-only, always via getAdminDb(). The code alphabet/shape/generation lives in
// `@gm/core/security/invite-code` (unit-tested keyless), but packages/db must NOT import
// packages/core (cycle rule) — so the caller INJECTS the generator here, and the route/worker
// (which may import core) normalizes untrusted input before calling `redeemWaitlistInvite`.
// ---------------------------------------------------------------------------

/** Pre-migration-safe: true when the error is a missing invite column / table (0021 not applied). */
function isPreInviteMigration(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("invite_code") ||
    msg.includes("invite_redeemed_at") ||
    (msg.includes("waitlist_submissions") && msg.includes("does not exist"))
  );
}

/**
 * Issue (or reuse) a beta invite code for a waitlisted email. Idempotent: if the email already has
 * a code, that same code is returned (a person keeps ONE beta key). Returns null if the email isn't
 * on the waitlist, or if migration 0021 hasn't been applied yet (degrade, never crash).
 *
 * `generateCode` is injected by the caller (the worker script supplies
 * `() => generateInviteCode(randomBytes)` from @gm/core + node:crypto) so this stays free of the
 * core dependency. Retries on the vanishingly unlikely UNIQUE collision with a fresh code.
 */
export async function issueWaitlistInvite(
  db: Querier,
  email: string,
  generateCode: () => string,
): Promise<string | null> {
  try {
    const existing = (await db.execute(
      sql`SELECT invite_code FROM waitlist_submissions WHERE lower(email) = lower(${email}) LIMIT 1`,
    )) as unknown as Array<{ invite_code: string | null }>;
    if (existing.length === 0) return null; // not a waitlisted email
    if (existing[0]!.invite_code) return existing[0]!.invite_code; // idempotent — reuse

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      try {
        const rows = (await db.execute(
          sql`UPDATE waitlist_submissions
              SET invite_code = ${code}, invite_issued_at = now()
              WHERE lower(email) = lower(${email}) AND invite_code IS NULL
              RETURNING invite_code`,
        )) as unknown as Array<{ invite_code: string }>;
        if (rows.length > 0) return rows[0]!.invite_code;
        // A concurrent issue set a code between our SELECT and UPDATE — read it back and reuse.
        const now = (await db.execute(
          sql`SELECT invite_code FROM waitlist_submissions WHERE lower(email) = lower(${email}) LIMIT 1`,
        )) as unknown as Array<{ invite_code: string | null }>;
        if (now[0]?.invite_code) return now[0]!.invite_code;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // UNIQUE violation on invite_code = a cross-email code collision → retry with a fresh code.
        if (msg.includes("invite_code") && (msg.includes("duplicate") || msg.includes("unique"))) continue;
        throw err;
      }
    }
    return null; // gave up after retries (essentially impossible with 50-bit codes)
  } catch (err) {
    if (isPreInviteMigration(err)) return null;
    throw err;
  }
}

/**
 * Redeem a beta invite code. IDEMPOTENT by design: a code is a per-person beta KEY, so a cleared
 * cookie / second device re-redeems the same code — the first redemption timestamp is kept
 * (COALESCE) for cohort metrics. `canonicalCode` MUST already be normalized+validated by the caller
 * (via @gm/core/security/invite-code) — this does an exact match. Returns the owning email on
 * success, or null when the code doesn't exist / migration 0021 isn't applied (never crashes).
 */
export async function redeemWaitlistInvite(
  db: Querier,
  canonicalCode: string,
): Promise<{ email: string } | null> {
  try {
    const rows = (await db.execute(
      sql`UPDATE waitlist_submissions
          SET invite_redeemed_at = COALESCE(invite_redeemed_at, now())
          WHERE invite_code = ${canonicalCode}
          RETURNING email`,
    )) as unknown as Array<{ email: string }>;
    if (rows.length === 0) return null;
    return { email: rows[0]!.email };
  } catch (err) {
    if (isPreInviteMigration(err)) return null;
    throw err;
  }
}

/** Count issued vs redeemed invites — admin dashboard + growth snapshot. Zeroes pre-migration. */
export async function getWaitlistInviteStats(
  db: Querier,
): Promise<{ issued: number; redeemed: number }> {
  try {
    const rows = (await db.execute(
      sql`SELECT
            count(*) FILTER (WHERE invite_code IS NOT NULL)::text AS issued,
            count(*) FILTER (WHERE invite_redeemed_at IS NOT NULL)::text AS redeemed
          FROM waitlist_submissions`,
    )) as unknown as Array<{ issued: string; redeemed: string }>;
    return {
      issued: parseInt(rows[0]?.issued ?? "0", 10),
      redeemed: parseInt(rows[0]?.redeemed ?? "0", 10),
    };
  } catch (err) {
    if (isPreInviteMigration(err)) return { issued: 0, redeemed: 0 };
    throw err;
  }
}

/**
 * The next `limit` confirmed (double-opt-in) waitlist emails that don't yet have an invite code —
 * the roll-out queue the owner's issuance script mints codes for, oldest-confirmed first.
 */
export async function listUnissuedConfirmedEmails(db: Querier, limit: number): Promise<string[]> {
  try {
    const rows = (await db.execute(
      sql`SELECT email FROM waitlist_submissions
          WHERE invite_code IS NULL AND confirmed_at IS NOT NULL
          ORDER BY confirmed_at ASC
          LIMIT ${limit}`,
    )) as unknown as Array<{ email: string }>;
    return rows.map((r) => r.email);
  } catch (err) {
    if (isPreInviteMigration(err)) return [];
    throw err;
  }
}
