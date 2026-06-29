import { timingSafeEqual } from "crypto";
import {
  getAdminDb,
  getWaitlistByWeek,
  getSubscribersByWeek,
  getWaitlistSegmentCounts,
  getCohortRetention,
} from "@gm/db";
import {
  buildAnalyticsSurface,
  type WeekBucket,
  type TimeSeriesPoint,
} from "@gm/core/growth/analytics";
import { auth } from "@/auth";
import { serverError } from "../../_lib/guard";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * H9 — Analytics SURFACE read-API (privacy-safe server-computed AGGREGATES only).
 *
 * GET /api/growth/analytics
 *
 * Returns the AnalyticsSurface — funnel aggregates, cohort retention, time series, segment
 * breakdown — shaped from real DB aggregates. ALL outputs are aggregate counts/rates; no PII,
 * no raw per-user event logs, nothing that could re-identify a user.
 *
 * Auth (either): an admin session (user email === ADMIN_EMAIL), OR a CRON_SECRET bearer token.
 * Same guard as /api/growth/snapshot (copied verbatim — keep them in sync).
 */
export async function GET(req: Request) {
  // --- Rate limit — same budget as snapshot (low-volume admin/cron) ---
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  const rl = rateLimit(`growth-analytics:${ip}`, 30, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  // --- AuthZ: admin session OR CRON_SECRET bearer ---
  const cronSecret = process.env["CRON_SECRET"];
  const authHeader = req.headers.get("authorization");
  let authorized = false;

  if (cronSecret && authHeader) {
    const expected = `Bearer ${cronSecret}`;
    const ab = Buffer.from(authHeader, "utf8");
    const bb = Buffer.from(expected, "utf8");
    authorized = ab.length === bb.length && timingSafeEqual(ab, bb);
  }
  if (!authorized) {
    const session = await auth();
    const userEmail = (session?.user as { email?: string } | undefined)?.email;
    const adminEmail = process.env["ADMIN_EMAIL"];
    authorized = !!userEmail && !!adminEmail && userEmail === adminEmail;
  }
  if (!authorized) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const db = getAdminDb();
    const asOf = new Date().toISOString().slice(0, 10);

    // --- Source connectivity flags ---
    const waitlistConnected = true; // always available once migrated (getWaitlistByWeek handles pre-migration)
    const billingConnected = !!process.env["STRIPE_SECRET_KEY"];
    const plausibleDomain = process.env["NEXT_PUBLIC_PLAUSIBLE_DOMAIN"];
    const plausibleKey = process.env["PLAUSIBLE_API_KEY"];
    const analyticsConnected = !!(plausibleDomain && plausibleKey);

    // --- Fetch aggregates best-effort (each independently graceful) ---
    const [waitlistByWeekRaw, subscribersByWeekRaw, segmentCountsRaw, cohortRowsRaw] =
      await Promise.all([
        getWaitlistByWeek(db).catch(() => null),
        billingConnected ? getSubscribersByWeek(db).catch(() => null) : Promise.resolve(null),
        getWaitlistSegmentCounts(db).catch(() => null),
        // Privacy-safe server-computed AGGREGATE cohorts (no per-user rows). null pre-migration.
        getCohortRetention(db).catch(() => null),
      ]);

    // Shape the WeeklyCountRow → WeekBucket (same structure, explicit cast).
    const toWeekBuckets = (rows: typeof waitlistByWeekRaw): WeekBucket[] | null =>
      rows ? rows.map((r) => ({ week: r.week, count: r.count })) : null;

    const toTimeSeriesPoints = (rows: typeof waitlistByWeekRaw): TimeSeriesPoint[] | null =>
      rows ? rows.map((r) => ({ date: r.week, count: r.count })) : null;

    const surface = buildAnalyticsSurface({
      asOf,
      funnel: {
        waitlistConnected,
        waitlistByWeek: toWeekBuckets(waitlistByWeekRaw),
        analyticsConnected,
        visitors7d: 0, // Plausible pull is in the snapshot route; analytics surface uses stored aggregates
        waitlist7d: 0, // same — the time-series captures weekly granularity
        billingConnected,
        subscribersByWeek: toWeekBuckets(subscribersByWeekRaw),
      },
      cohort: {
        // Connected only when the query returned a real (non-null) aggregate — null means the
        // source tables are absent (pre-migration) → honest disconnected. The rows carry only
        // cohort_week / cohort_size / retained_counts (no PII); getCohortRetention enforces that.
        connected: cohortRowsRaw !== null,
        rows: cohortRowsRaw,
      },
      timeSeries: {
        connected: waitlistConnected && waitlistByWeekRaw !== null,
        points: toTimeSeriesPoints(waitlistByWeekRaw),
        bucket: "week",
      },
      segment: {
        connected: waitlistConnected && segmentCountsRaw !== null,
        counts: segmentCountsRaw
          ? segmentCountsRaw.map((r) => ({ segment: r.segment, count: r.count }))
          : null,
      },
    });

    return Response.json(surface, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return serverError("growth/analytics", err);
  }
}
