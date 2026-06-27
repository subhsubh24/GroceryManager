import { describe, it, expect } from "vitest";
import { buildGrowthSnapshot, computeMrrUsd, type GrowthSnapshotInputs } from "./snapshot.js";

const base: GrowthSnapshotInputs = {
  asOf: "2026-06-27",
  engineBuilt: true,
  waitlistTotal: 0,
  waitlist7d: 0,
  waitlistConfirmed: 0,
  plausibleConnected: false,
  visitors7d: 0,
  stripeConnected: false,
  activeSubscribers: 0,
  mrrUsd: 0,
  emailConnected: false,
};

describe("buildGrowthSnapshot", () => {
  it("reports pre_launch + awaiting_connect with no external channels", () => {
    const s = buildGrowthSnapshot(base);
    expect(s.phase).toBe("pre_launch");
    expect(s.awaiting_connect).toBe(true);
    expect(s.channels_connected).toEqual([]);
    expect(s.sources.analytics).toBe("awaiting_connect");
    expect(s.sources.billing).toBe("awaiting_connect");
    expect(s.sources.email).toBe("awaiting_connect");
    // waitlist table exists (total 0, not null) → connected
    expect(s.sources.waitlist).toBe("connected");
  });

  it("marks waitlist awaiting_connect when the table is missing (null total)", () => {
    const s = buildGrowthSnapshot({ ...base, waitlistTotal: null, waitlist7d: 5 });
    expect(s.sources.waitlist).toBe("awaiting_connect");
    expect(s.funnel.waitlist_signups_total).toBe(0);
    // 7d is forced to 0 when the table is missing — never report a number we can't back
    expect(s.funnel.waitlist_signups_7d).toBe(0);
  });

  it("surfaces real waitlist numbers when migrated", () => {
    const s = buildGrowthSnapshot({ ...base, waitlistTotal: 42, waitlist7d: 7, waitlistConfirmed: 30 });
    expect(s.funnel.waitlist_signups_total).toBe(42);
    expect(s.funnel.waitlist_signups_7d).toBe(7);
    expect(s.email.list_size).toBe(30);
    expect(s.email.double_opt_in).toBe(true);
  });

  it("computes visitor→waitlist rate only when analytics connected", () => {
    const off = buildGrowthSnapshot({ ...base, waitlist7d: 10, visitors7d: 100 });
    expect(off.funnel.visitors_7d).toBe(0); // not connected → 0, not 100
    expect(off.funnel.visitor_to_waitlist_rate).toBeNull();

    const on = buildGrowthSnapshot({
      ...base,
      plausibleConnected: true,
      visitors7d: 100,
      waitlistTotal: 10,
      waitlist7d: 10,
    });
    expect(on.funnel.visitors_7d).toBe(100);
    expect(on.funnel.visitor_to_waitlist_rate).toBe(0.1);
    expect(on.channels_connected).toContain("analytics");
    expect(on.awaiting_connect).toBe(false);
  });

  it("reports launching when stripe connected but no subscribers", () => {
    const s = buildGrowthSnapshot({ ...base, stripeConnected: true });
    expect(s.phase).toBe("launching");
    expect(s.sources.billing).toBe("connected");
    expect(s.funnel.active_subscribers).toBe(0);
  });

  it("reports post_launch with real subscribers + MRR", () => {
    const s = buildGrowthSnapshot({
      ...base,
      stripeConnected: true,
      activeSubscribers: 12,
      mrrUsd: 60,
    });
    expect(s.phase).toBe("post_launch");
    expect(s.funnel.active_subscribers).toBe(12);
    expect(s.funnel.paid_conversions_total).toBe(12);
    expect(s.funnel.mrr_usd).toBe(60);
  });

  it("never leaks subscriber numbers when stripe is disconnected", () => {
    const s = buildGrowthSnapshot({ ...base, activeSubscribers: 99, mrrUsd: 500 });
    expect(s.funnel.active_subscribers).toBe(0);
    expect(s.funnel.mrr_usd).toBe(0);
  });

  it("clamps negative inputs to 0", () => {
    const s = buildGrowthSnapshot({
      ...base,
      stripeConnected: true,
      activeSubscribers: -5,
      mrrUsd: -10,
      plausibleConnected: true,
      visitors7d: -1,
    });
    expect(s.funnel.active_subscribers).toBe(0);
    expect(s.funnel.mrr_usd).toBe(0);
    expect(s.funnel.visitors_7d).toBe(0);
  });
});

describe("computeMrrUsd", () => {
  it("sums tier prices to whole USD", () => {
    // 2×4.99 + 1×3.3325 + 1×9.99 = 9.98 + 3.33 + 9.99 = 23.30 → 23
    expect(computeMrrUsd({ monthly: 2, annual: 1, family: 1 })).toBe(23);
  });
  it("is 0 with no subscribers", () => {
    expect(computeMrrUsd({ monthly: 0, annual: 0, family: 0 })).toBe(0);
  });
  it("annual is amortized monthly (39.99/12 ≈ 3.33)", () => {
    expect(computeMrrUsd({ monthly: 0, annual: 3, family: 0 })).toBe(10); // 3×3.33 = 9.99 → 10
  });
});
