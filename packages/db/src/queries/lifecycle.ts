/**
 * Lifecycle email campaign queries (H14 month-3 annual-nudge + H15 win-back).
 *
 * These read across ALL users to find campaign-eligible recipients, so they run via the admin
 * (RLS-bypassing) connection from a CRON_SECRET-gated route only — never a per-tenant request.
 * They return AGGREGATE-minimal recipient rows (id + email + name) needed to send; no other PII.
 *
 * Eligibility is derived from the append-only `preference_signals` ledger (the same source the
 * billing/snapshot queries use): a user's LATEST `entitlement` signal is `premium` ⇔ active; the
 * webhook writes `entitlement=null` on cancellation, so a churned user's latest is NULL/non-premium.
 * Users with a latest `email_optout='true'` signal are always excluded (CAN-SPAM honesty), as are
 * users already recorded in `lifecycle_email_sends` for that campaign (idempotency).
 *
 * Tables created by raw SQL migrations use db.execute(sql`…`) to match the existing query pattern.
 */
import { sql } from "drizzle-orm";
import type { Querier } from "../client.js";
import { appendPreferenceSignal } from "../queries.js";

/** A campaign-eligible recipient. `name` is best-effort (nullable) for greeting personalization. */
export interface LifecycleCandidate {
  userId: string;
  email: string;
  name: string | null;
}

/** Hard cap on recipients per run — bounds a single cron invocation (matches the email batch limit). */
const RUN_LIMIT = 500;

// Latest-signal-per-user CTEs reused by both campaigns. `email_optout` is excluded everywhere.
const NOT_OPTED_OUT = sql`
  NOT EXISTS (
    SELECT 1 FROM (
      SELECT DISTINCT ON (user_id) user_id, value
      FROM preference_signals
      WHERE topic = 'email_optout'
      ORDER BY user_id, occurred_at DESC
    ) lo
    WHERE lo.user_id = u.id AND lo.value = 'true'
  )`;

/**
 * H14 — monthly subscribers whose subscription has been active ≥ 90 days, who haven't already
 * received the annual nudge. The annual rate is materially cheaper, so the month-3 mark is the
 * renewal-salient moment to surface it. Skips annual/family (already on the better/other plan).
 */
export async function getAnnualNudgeCandidates(db: Querier): Promise<LifecycleCandidate[]> {
  const rows = (await db.execute(
    sql`WITH latest_ent AS (
          SELECT DISTINCT ON (user_id) user_id, value
          FROM preference_signals WHERE topic = 'entitlement'
          ORDER BY user_id, occurred_at DESC
        ),
        latest_tier AS (
          SELECT DISTINCT ON (user_id) user_id, value
          FROM preference_signals WHERE topic = 'subscription_tier'
          ORDER BY user_id, occurred_at DESC
        ),
        first_premium AS (
          SELECT user_id, min(occurred_at) AS started_at
          FROM preference_signals WHERE topic = 'entitlement' AND value = 'premium'
          GROUP BY user_id
        )
        SELECT u.id AS user_id, u.email AS email, u.name AS name
        FROM latest_ent le
        JOIN latest_tier lt ON lt.user_id = le.user_id
        JOIN first_premium fp ON fp.user_id = le.user_id
        JOIN users u ON u.id = le.user_id
        WHERE le.value = 'premium'
          AND lt.value = 'premium_monthly'
          AND fp.started_at <= now() - interval '90 days'
          AND u.email IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM lifecycle_email_sends s
            WHERE s.user_id = u.id AND s.email_type = 'h14_annual_nudge'
          )
          AND ${NOT_OPTED_OUT}
        LIMIT ${RUN_LIMIT}`,
  )) as unknown as Array<{ user_id: string; email: string; name: string | null }>;
  return rows.map((r) => ({ userId: r.user_id, email: r.email, name: r.name }));
}

/**
 * H15 — users who churned (ever had premium; latest entitlement is no longer premium) at least 30
 * days ago BUT are still active on the free tier (cooked in the last 30 days) — the highest-intent
 * win-back audience. Excludes anyone who has since re-subscribed (latest entitlement = premium).
 *
 * The `entitlement` signal is BINARY by the Stripe webhook's contract: it writes value `'premium'`
 * (active) or `null` (inactive/cancelled) and never an intermediate string, so
 * `value IS DISTINCT FROM 'premium'` correctly identifies the churned (null) state without matching
 * any non-premium-non-null tier. `occurred_at` of that latest signal is the cancellation time.
 */
export async function getWinbackCandidates(db: Querier): Promise<LifecycleCandidate[]> {
  const rows = (await db.execute(
    sql`WITH latest_ent AS (
          SELECT DISTINCT ON (user_id) user_id, value, occurred_at
          FROM preference_signals WHERE topic = 'entitlement'
          ORDER BY user_id, occurred_at DESC
        ),
        ever_premium AS (
          SELECT DISTINCT user_id FROM preference_signals
          WHERE topic = 'entitlement' AND value = 'premium'
        )
        SELECT u.id AS user_id, u.email AS email, u.name AS name
        FROM latest_ent le
        JOIN ever_premium ep ON ep.user_id = le.user_id
        JOIN users u ON u.id = le.user_id
        WHERE le.value IS DISTINCT FROM 'premium'
          AND le.occurred_at <= now() - interval '30 days'
          AND u.email IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM meal_logs ml
            WHERE ml.user_id = u.id AND ml.cooked_at >= now() - interval '30 days'
          )
          AND NOT EXISTS (
            SELECT 1 FROM lifecycle_email_sends s
            WHERE s.user_id = u.id AND s.email_type = 'h15_winback'
          )
          AND ${NOT_OPTED_OUT}
        LIMIT ${RUN_LIMIT}`,
  )) as unknown as Array<{ user_id: string; email: string; name: string | null }>;
  return rows.map((r) => ({ userId: r.user_id, email: r.email, name: r.name }));
}

// ---------------------------------------------------------------------------
// Trial lifecycle (T1–T3 / H16–H18) candidate queries.
//
// These target users MID-TRIAL. The Stripe webhook writes a `subscription_status` signal (raw
// `sub.status`: 'trialing' | 'active' | 'past_due' | … ; 'canceled' on deletion) and, when the
// subscription carries one, a `trial_end_at` signal (the ISO trial-end timestamp). A user's LATEST
// `subscription_status` = 'trialing' is PRECISELY "started a trial and has NOT yet converted (a
// conversion writes status='active') or cancelled (deletion writes status='canceled')". The trial
// window is 7 days and auto-converts, so the three queries slice the remaining time to stage the
// welcome (early), the ~2-days-left reminder, and the ends-today expiry email — never sending a
// stale/duplicate one (idempotency via `lifecycle_email_sends`).
// ---------------------------------------------------------------------------

/** DISTINCT ON latest `subscription_status` value per user (raw Stripe status). */
const LATEST_STATUS = sql`
  latest_status AS (
    SELECT DISTINCT ON (user_id) user_id, value
    FROM preference_signals WHERE topic = 'subscription_status'
    ORDER BY user_id, occurred_at DESC
  )`;

/** DISTINCT ON latest `trial_end_at` value per user (ISO timestamp string). */
const LATEST_TRIAL_END = sql`
  latest_trial_end AS (
    SELECT DISTINCT ON (user_id) user_id, value
    FROM preference_signals WHERE topic = 'trial_end_at'
    ORDER BY user_id, occurred_at DESC
  )`;

/**
 * H16 / T1 — trial WELCOME. Latest status = 'trialing' (still trialing: not yet converted or
 * cancelled) AND the trial still has more than 3 of its 7 days left (don't "welcome" someone about
 * to expire), who hasn't already received the welcome. Excludes opted-out + no-email users.
 */
export async function getTrialWelcomeCandidates(db: Querier): Promise<LifecycleCandidate[]> {
  const rows = (await db.execute(
    sql`WITH ${LATEST_STATUS}, ${LATEST_TRIAL_END}
        SELECT u.id AS user_id, u.email AS email, u.name AS name
        FROM latest_status ls
        JOIN latest_trial_end lte ON lte.user_id = ls.user_id
        JOIN users u ON u.id = ls.user_id
        WHERE ls.value = 'trialing'
          AND lte.value::timestamptz > now() + interval '3 days'
          AND u.email IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM lifecycle_email_sends s
            WHERE s.user_id = u.id AND s.email_type = 'h16_trial_welcome'
          )
          AND ${NOT_OPTED_OUT}
        LIMIT ${RUN_LIMIT}`,
  )) as unknown as Array<{ user_id: string; email: string; name: string | null }>;
  return rows.map((r) => ({ userId: r.user_id, email: r.email, name: r.name }));
}

/**
 * H17 / T2 — trial REMINDER (~2 days left). Latest status = 'trialing' AND trial end is between
 * 1 and 3 days out (the ~2-days-left window), who hasn't already received the reminder. Excludes
 * opted-out + no-email users.
 */
export async function getTrialReminderCandidates(db: Querier): Promise<LifecycleCandidate[]> {
  const rows = (await db.execute(
    sql`WITH ${LATEST_STATUS}, ${LATEST_TRIAL_END}
        SELECT u.id AS user_id, u.email AS email, u.name AS name
        FROM latest_status ls
        JOIN latest_trial_end lte ON lte.user_id = ls.user_id
        JOIN users u ON u.id = ls.user_id
        WHERE ls.value = 'trialing'
          AND lte.value::timestamptz > now() + interval '1 day'
          AND lte.value::timestamptz <= now() + interval '3 days'
          AND u.email IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM lifecycle_email_sends s
            WHERE s.user_id = u.id AND s.email_type = 'h17_trial_reminder'
          )
          AND ${NOT_OPTED_OUT}
        LIMIT ${RUN_LIMIT}`,
  )) as unknown as Array<{ user_id: string; email: string; name: string | null }>;
  return rows.map((r) => ({ userId: r.user_id, email: r.email, name: r.name }));
}

/**
 * H18 / T3 — trial EXPIRY (ends today). Latest status = 'trialing' AND the trial ends within the
 * next day (still in the future — not already lapsed), who hasn't already received the expiry
 * email. This is the anti-surprise-charge + annual-upsell moment. Excludes opted-out + no-email users.
 */
export async function getTrialExpiryCandidates(db: Querier): Promise<LifecycleCandidate[]> {
  const rows = (await db.execute(
    sql`WITH ${LATEST_STATUS}, ${LATEST_TRIAL_END}
        SELECT u.id AS user_id, u.email AS email, u.name AS name
        FROM latest_status ls
        JOIN latest_trial_end lte ON lte.user_id = ls.user_id
        JOIN users u ON u.id = ls.user_id
        WHERE ls.value = 'trialing'
          AND lte.value::timestamptz > now()
          AND lte.value::timestamptz <= now() + interval '1 day'
          AND u.email IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM lifecycle_email_sends s
            WHERE s.user_id = u.id AND s.email_type = 'h18_trial_expiry'
          )
          AND ${NOT_OPTED_OUT}
        LIMIT ${RUN_LIMIT}`,
  )) as unknown as Array<{ user_id: string; email: string; name: string | null }>;
  return rows.map((r) => ({ userId: r.user_id, email: r.email, name: r.name }));
}

/**
 * Record that a lifecycle email truly left for a user (idempotent on (user_id, email_type)).
 * Call ONLY after the provider returned sent=true — never on a dry-run/skip — so a campaign retries
 * once the owner connects a provider. Best-effort: the caller swallows failures.
 */
export async function recordLifecycleEmailSent(
  db: Querier,
  args: { userId: string; emailType: string; variant: string | null },
): Promise<void> {
  await db.execute(
    sql`INSERT INTO lifecycle_email_sends (user_id, email_type, variant)
        VALUES (${args.userId}, ${args.emailType}, ${args.variant})
        ON CONFLICT (user_id, email_type) DO NOTHING`,
  );
}

/**
 * Record an email opt-out for a user (CAN-SPAM unsubscribe). Idempotent — appends a signal whose
 * latest value the candidate queries honor. Written via the admin connection from the public,
 * token-verified unsubscribe route.
 */
export async function recordEmailOptOut(db: Querier, userId: string): Promise<void> {
  await appendPreferenceSignal(db, {
    userId,
    topic: "email_optout",
    value: "true",
    polarity: "negative",
    source: "correction",
    confidence: 1,
  });
}
