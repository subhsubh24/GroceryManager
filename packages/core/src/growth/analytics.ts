/**
 * H9 — Analytics SURFACE: pure builders that shape already-fetched aggregates into the
 * privacy-safe shapes the Growth Agent consumes.
 *
 * HONESTY BAR:
 * - Rates are null (not 0) when the denominator is 0 or the source is disconnected.
 * - small-N cohorts carry `low_sample: true` — never fabricate a retention rate.
 * - No PII fields present in any output type; only counts and rates.
 *
 * Pure + framework-agnostic: no I/O, no env reads. The route fetches the raw aggregates
 * and passes them into these builders.
 */

/** Round to a fixed number of decimals, returning null for non-finite inputs. */
function round(n: number, dp = 4): number | null {
  if (!Number.isFinite(n)) return null;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// Funnel aggregates
// ---------------------------------------------------------------------------

export interface FunnelAggregates {
  /** Signups per week bucket, newest last. null when source disconnected. */
  waitlist_by_week: WeekBucket[] | null;
  /** Subscribers per week bucket, newest last. null when billing disconnected. */
  subscribers_by_week: WeekBucket[] | null;
  /** Visitor→waitlist conversion rate (null when analytics disconnected or no visitors). */
  visitor_to_waitlist_rate: number | null;
  /** Sample sizes for transparency. */
  sample_sizes: { waitlist_total: number | null; subscribers_total: number | null };
}

export interface WeekBucket {
  /** ISO week start (YYYY-MM-DD). */
  week: string;
  count: number;
}

export interface FunnelInput {
  waitlistConnected: boolean;
  /** Rows from getWaitlistByWeek() — or null when the table is missing. */
  waitlistByWeek: WeekBucket[] | null;
  analyticsConnected: boolean;
  /** Total visitors in last 7d (0 when not connected). */
  visitors7d: number;
  /** Waitlist signups in last 7d. */
  waitlist7d: number;
  billingConnected: boolean;
  subscribersByWeek: WeekBucket[] | null;
}

export function buildFunnelAggregates(input: FunnelInput): FunnelAggregates {
  const waitlistTotal = input.waitlistConnected && input.waitlistByWeek
    ? input.waitlistByWeek.reduce((s, r) => s + r.count, 0)
    : null;
  const subscribersTotal = input.billingConnected && input.subscribersByWeek
    ? input.subscribersByWeek.reduce((s, r) => s + r.count, 0)
    : null;

  const visitorToWaitlist =
    input.analyticsConnected && input.visitors7d > 0
      ? round(input.waitlist7d / input.visitors7d)
      : null;

  return {
    waitlist_by_week: input.waitlistConnected ? (input.waitlistByWeek ?? []) : null,
    subscribers_by_week: input.billingConnected ? (input.subscribersByWeek ?? []) : null,
    visitor_to_waitlist_rate: visitorToWaitlist,
    sample_sizes: {
      waitlist_total: waitlistTotal,
      subscribers_total: subscribersTotal,
    },
  };
}

// ---------------------------------------------------------------------------
// Cohort retention
// ---------------------------------------------------------------------------

/** Minimum cohort size before we report retention fractions (small-N → low_sample flag). */
const LOW_SAMPLE_THRESHOLD = 20;

export interface CohortRetentionRow {
  /** ISO week start. */
  cohort_week: string;
  /** Users in this cohort. */
  cohort_size: number;
  /**
   * Fraction retained per week-offset from cohort entry.
   * Index 0 = week 0 (cohort week itself), 1 = week 1, etc.
   * null when the offset hasn't been reached yet or denominator is 0.
   */
  retention_by_week: (number | null)[];
  /** True when cohort_size < LOW_SAMPLE_THRESHOLD — rates are unreliable. */
  low_sample: boolean;
}

export interface CohortInput {
  connected: boolean;
  /** Pre-aggregated cohort rows from DB. */
  rows: RawCohortRow[] | null;
}

export interface RawCohortRow {
  cohort_week: string;
  cohort_size: number;
  /** Retained counts per week offset (index = offset). */
  retained_counts: (number | null)[];
}

export function buildCohortRetention(input: CohortInput): CohortRetentionRow[] | null {
  if (!input.connected || !input.rows) return null;
  return input.rows.map((row) => {
    const lowSample = row.cohort_size < LOW_SAMPLE_THRESHOLD;
    const retention_by_week: (number | null)[] = row.retained_counts.map((c) => {
      if (c == null) return null;
      if (row.cohort_size <= 0) return null;
      if (lowSample) return null; // don't report fractions for tiny cohorts
      return round(c / row.cohort_size);
    });
    return {
      cohort_week: row.cohort_week,
      cohort_size: row.cohort_size,
      retention_by_week,
      low_sample: lowSample,
    };
  });
}

// ---------------------------------------------------------------------------
// Time series
// ---------------------------------------------------------------------------

export type TimeBucket = "day" | "week";

export interface TimeSeriesPoint {
  /** ISO date or week start. */
  date: string;
  count: number;
}

export interface TimeSeriesInput {
  connected: boolean;
  points: TimeSeriesPoint[] | null;
  bucket: TimeBucket;
}

export interface TimeSeries {
  bucket: TimeBucket;
  points: TimeSeriesPoint[] | null;
  total: number | null;
}

export function buildTimeSeries(input: TimeSeriesInput): TimeSeries {
  if (!input.connected || !input.points) {
    return { bucket: input.bucket, points: null, total: null };
  }
  const total = input.points.reduce((s, p) => s + p.count, 0);
  return { bucket: input.bucket, points: input.points, total };
}

// ---------------------------------------------------------------------------
// Segment breakdown
// ---------------------------------------------------------------------------

export interface SegmentBreakdown {
  /** Breakdown by utm_source. null when source disconnected or no data. */
  by_utm_source: SegmentRow[] | null;
}

export interface SegmentRow {
  /** The segment value (e.g. utm_source name). null means "organic / direct". */
  segment: string | null;
  count: number;
  /** Share of total (null when total is 0). */
  share: number | null;
}

export interface SegmentInput {
  connected: boolean;
  counts: Array<{ segment: string | null; count: number }> | null;
}

export function buildSegmentBreakdown(input: SegmentInput): SegmentBreakdown {
  if (!input.connected || !input.counts) {
    return { by_utm_source: null };
  }
  const total = input.counts.reduce((s, r) => s + r.count, 0);
  const rows: SegmentRow[] = input.counts.map((r) => ({
    segment: r.segment,
    count: r.count,
    share: total > 0 ? round(r.count / total) : null,
  }));
  return { by_utm_source: rows };
}

// ---------------------------------------------------------------------------
// Combined AnalyticsSurface
// ---------------------------------------------------------------------------

export interface AnalyticsSurface {
  /** ISO date this surface was assembled. */
  as_of: string;
  /** Per-source connectivity flags (mirrors GrowthSnapshot.sources). */
  sources: {
    waitlist: boolean;
    analytics: boolean;
    billing: boolean;
  };
  funnel: FunnelAggregates;
  cohort_retention: CohortRetentionRow[] | null;
  waitlist_time_series: TimeSeries;
  segment_breakdown: SegmentBreakdown;
}

export interface AnalyticsSurfaceInput {
  asOf: string;
  funnel: FunnelInput;
  cohort: CohortInput;
  timeSeries: TimeSeriesInput;
  segment: SegmentInput;
}

/** Combine all sub-surfaces into the single AnalyticsSurface the agent consumes. */
export function buildAnalyticsSurface(input: AnalyticsSurfaceInput): AnalyticsSurface {
  return {
    as_of: input.asOf,
    sources: {
      waitlist: input.funnel.waitlistConnected,
      analytics: input.funnel.analyticsConnected,
      billing: input.funnel.billingConnected,
    },
    funnel: buildFunnelAggregates(input.funnel),
    cohort_retention: buildCohortRetention(input.cohort),
    waitlist_time_series: buildTimeSeries(input.timeSeries),
    segment_breakdown: buildSegmentBreakdown(input.segment),
  };
}
