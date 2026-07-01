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
    // Confirmed count is always honest from our own datastore...
    expect(s.funnel.waitlist_confirmed).toBe(30);
    // ...but email.list_size is 0 until an email PROVIDER is connected (no provider ⇒ no list).
    expect(s.email.list_size).toBe(0);
    expect(s.email.double_opt_in).toBe(true);
  });

  it("reports email.list_size only when an email provider is connected", () => {
    const s = buildGrowthSnapshot({
      ...base,
      waitlistTotal: 42,
      waitlistConfirmed: 30,
      emailConnected: true,
    });
    expect(s.email.list_size).toBe(30);
    expect(s.funnel.waitlist_confirmed).toBe(30);
    expect(s.sources.email).toBe("connected");
    expect(s.channels_connected).toContain("email");
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
    // 2×499 + 1×333.25 (annual $39.99/12) + 1×999 ≈ 2330 cents → $23
    expect(computeMrrUsd({ monthly: 2, annual: 1, family: 1 })).toBe(23);
  });
  it("is 0 with no subscribers", () => {
    expect(computeMrrUsd({ monthly: 0, annual: 0, family: 0 })).toBe(0);
  });
  it("annual is amortized monthly (39.99/12 ≈ 3.33)", () => {
    expect(computeMrrUsd({ monthly: 0, annual: 3, family: 0 })).toBe(10); // 3×3.3325 = 9.9975 → 10
  });
  it("amortizes annual on the aggregate (no per-sub rounding bias)", () => {
    // 56 annual subs = 56×$39.99/12 = $186.62 → $187. The old per-sub round(3999/12)=333¢ gave
    // 56×333 = $186.48 → $186, understating MRR by a whole dollar. Guards the aggregate-rounding fix.
    expect(computeMrrUsd({ monthly: 0, annual: 56, family: 0 })).toBe(187);
  });
});
