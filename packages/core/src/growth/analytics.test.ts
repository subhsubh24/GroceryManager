import { describe, it, expect } from "vitest";
import {
  buildFunnelAggregates,
  buildCohortRetention,
  buildTimeSeries,
  buildSegmentBreakdown,
  buildAnalyticsSurface,
} from "./analytics.js";
import type {
  FunnelInput,
  CohortInput,
  TimeSeriesInput,
  SegmentInput,
  AnalyticsSurfaceInput,
} from "./analytics.js";

// ---------------------------------------------------------------------------
// buildFunnelAggregates
// ---------------------------------------------------------------------------

describe("buildFunnelAggregates", () => {
  const baseInput: FunnelInput = {
    waitlistConnected: false,
    waitlistByWeek: null,
    analyticsConnected: false,
    visitors7d: 0,
    waitlist7d: 0,
    billingConnected: false,
    subscribersByWeek: null,
  };

  it("returns nulls when all sources disconnected", () => {
    const f = buildFunnelAggregates(baseInput);
    expect(f.waitlist_by_week).toBeNull();
    expect(f.subscribers_by_week).toBeNull();
    expect(f.visitor_to_waitlist_rate).toBeNull();
    expect(f.sample_sizes.waitlist_total).toBeNull();
  });

  it("returns waitlist_by_week when connected", () => {
    const input: FunnelInput = {
      ...baseInput,
      waitlistConnected: true,
      waitlistByWeek: [
        { week: "2026-06-01", count: 10 },
        { week: "2026-06-08", count: 15 },
      ],
    };
    const f = buildFunnelAggregates(input);
    expect(f.waitlist_by_week).toHaveLength(2);
    expect(f.sample_sizes.waitlist_total).toBe(25);
  });

  it("visitor_to_waitlist_rate is null when analytics disconnected", () => {
    const input: FunnelInput = {
      ...baseInput,
      analyticsConnected: false,
      visitors7d: 100,
      waitlist7d: 10,
    };
    const f = buildFunnelAggregates(input);
    expect(f.visitor_to_waitlist_rate).toBeNull();
  });

  it("visitor_to_waitlist_rate is null when analytics connected but visitors=0", () => {
    const input: FunnelInput = {
      ...baseInput,
      analyticsConnected: true,
      visitors7d: 0,
      waitlist7d: 5,
    };
    const f = buildFunnelAggregates(input);
    expect(f.visitor_to_waitlist_rate).toBeNull();
  });

  it("computes visitor_to_waitlist_rate correctly when connected", () => {
    const input: FunnelInput = {
      ...baseInput,
      analyticsConnected: true,
      visitors7d: 200,
      waitlist7d: 10,
      waitlistConnected: true,
      waitlistByWeek: [],
    };
    const f = buildFunnelAggregates(input);
    expect(f.visitor_to_waitlist_rate).toBeCloseTo(0.05, 4);
  });

  it("no PII fields present in output", () => {
    const input: FunnelInput = {
      ...baseInput,
      waitlistConnected: true,
      waitlistByWeek: [{ week: "2026-06-01", count: 3 }],
    };
    const f = buildFunnelAggregates(input);
    const json = JSON.stringify(f);
    expect(json).not.toContain("email");
    expect(json).not.toContain("user_id");
    expect(json).not.toContain("name");
  });
});

// ---------------------------------------------------------------------------
// buildCohortRetention
// ---------------------------------------------------------------------------

describe("buildCohortRetention", () => {
  it("returns null when disconnected", () => {
    const input: CohortInput = { connected: false, rows: null };
    expect(buildCohortRetention(input)).toBeNull();
  });

  it("returns empty array when connected but no rows", () => {
    const input: CohortInput = { connected: true, rows: [] };
    expect(buildCohortRetention(input)).toEqual([]);
  });

  it("sets low_sample:true for small cohorts and nulls out rates", () => {
    const input: CohortInput = {
      connected: true,
      rows: [{ cohort_week: "2026-06-01", cohort_size: 5, retained_counts: [5, 3, 1] }],
    };
    const result = buildCohortRetention(input)!;
    expect(result[0]!.low_sample).toBe(true);
    // All retention fractions should be null for low-sample cohort
    expect(result[0]!.retention_by_week.every((v) => v === null)).toBe(true);
  });

  it("computes retention fractions for adequate cohort", () => {
    const input: CohortInput = {
      connected: true,
      rows: [{ cohort_week: "2026-06-01", cohort_size: 50, retained_counts: [50, 30, 20] }],
    };
    const result = buildCohortRetention(input)!;
    expect(result[0]!.low_sample).toBe(false);
    expect(result[0]!.retention_by_week[0]).toBeCloseTo(1.0, 3);
    expect(result[0]!.retention_by_week[1]).toBeCloseTo(0.6, 3);
    expect(result[0]!.retention_by_week[2]).toBeCloseTo(0.4, 3);
  });
});

// ---------------------------------------------------------------------------
// buildTimeSeries
// ---------------------------------------------------------------------------

describe("buildTimeSeries", () => {
  it("returns null points when disconnected", () => {
    const input: TimeSeriesInput = { connected: false, points: null, bucket: "week" };
    const ts = buildTimeSeries(input);
    expect(ts.points).toBeNull();
    expect(ts.total).toBeNull();
  });

  it("sums counts for connected source", () => {
    const input: TimeSeriesInput = {
      connected: true,
      points: [
        { date: "2026-06-01", count: 5 },
        { date: "2026-06-08", count: 10 },
      ],
      bucket: "week",
    };
    const ts = buildTimeSeries(input);
    expect(ts.total).toBe(15);
    expect(ts.points).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// buildSegmentBreakdown
// ---------------------------------------------------------------------------

describe("buildSegmentBreakdown", () => {
  it("returns null when disconnected", () => {
    const input: SegmentInput = { connected: false, counts: null };
    const s = buildSegmentBreakdown(input);
    expect(s.by_utm_source).toBeNull();
  });

  it("computes share correctly", () => {
    const input: SegmentInput = {
      connected: true,
      counts: [
        { segment: "twitter", count: 40 },
        { segment: "organic", count: 60 },
      ],
    };
    const s = buildSegmentBreakdown(input);
    expect(s.by_utm_source).toHaveLength(2);
    const twitter = s.by_utm_source!.find((r) => r.segment === "twitter")!;
    expect(twitter.share).toBeCloseTo(0.4, 4);
  });

  it("handles null segment (organic/direct)", () => {
    const input: SegmentInput = {
      connected: true,
      counts: [{ segment: null, count: 10 }],
    };
    const s = buildSegmentBreakdown(input);
    expect(s.by_utm_source![0]!.segment).toBeNull();
    expect(s.by_utm_source![0]!.share).toBe(1);
  });

  it("share is null when total is 0", () => {
    const input: SegmentInput = {
      connected: true,
      counts: [{ segment: "foo", count: 0 }],
    };
    const s = buildSegmentBreakdown(input);
    expect(s.by_utm_source![0]!.share).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildAnalyticsSurface
// ---------------------------------------------------------------------------

describe("buildAnalyticsSurface", () => {
  const fullInput: AnalyticsSurfaceInput = {
    asOf: "2026-06-27",
    funnel: {
      waitlistConnected: true,
      waitlistByWeek: [{ week: "2026-06-20", count: 5 }],
      analyticsConnected: false,
      visitors7d: 0,
      waitlist7d: 5,
      billingConnected: false,
      subscribersByWeek: null,
    },
    cohort: { connected: false, rows: null },
    timeSeries: { connected: false, points: null, bucket: "week" },
    segment: { connected: false, counts: null },
  };

  it("surfaces sources correctly", () => {
    const surface = buildAnalyticsSurface(fullInput);
    expect(surface.sources.waitlist).toBe(true);
    expect(surface.sources.analytics).toBe(false);
    expect(surface.sources.billing).toBe(false);
  });

  it("as_of is preserved", () => {
    const surface = buildAnalyticsSurface(fullInput);
    expect(surface.as_of).toBe("2026-06-27");
  });

  it("nulls for disconnected sources", () => {
    const surface = buildAnalyticsSurface(fullInput);
    expect(surface.cohort_retention).toBeNull();
    expect(surface.waitlist_time_series.points).toBeNull();
    expect(surface.segment_breakdown.by_utm_source).toBeNull();
  });
});
