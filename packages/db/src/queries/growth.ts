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
