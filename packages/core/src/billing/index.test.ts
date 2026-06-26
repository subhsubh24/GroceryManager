import { describe, expect, it } from "vitest";
import { canUse, getCurrentSubscriptionTier, isPremium, PREMIUM_FEATURES, SUBSCRIPTION_PLANS } from "./index.js";

describe("isPremium", () => {
  it("is true when an entitlement=premium signal is present", () => {
    expect(isPremium([{ topic: "entitlement", value: "premium" }])).toBe(true);
    expect(isPremium([{ topic: "cuisine:thai", value: "thai" }, { topic: "entitlement", value: "premium" }])).toBe(true);
  });
  it("is false otherwise", () => {
    expect(isPremium([])).toBe(false);
    expect(isPremium([{ topic: "cuisine:thai", value: "thai" }])).toBe(false);
    expect(isPremium([{ topic: "entitlement", value: "free" }])).toBe(false);
  });
});

describe("canUse", () => {
  it("flag OFF → everything is allowed (fails open)", () => {
    for (const f of PREMIUM_FEATURES) expect(canUse(f, false, false)).toBe(true);
    expect(canUse("anything", false, false)).toBe(true);
  });
  it("flag ON → premium features require the entitlement", () => {
    expect(canUse("discover", false, true)).toBe(false);
    expect(canUse("discover", true, true)).toBe(true);
    expect(canUse("remix", false, true)).toBe(false);
  });
  it("flag ON → non-premium features are always allowed", () => {
    expect(canUse("pantry", false, true)).toBe(true);
    expect(canUse("list", false, true)).toBe(true);
  });
});

describe("getCurrentSubscriptionTier", () => {
  it("returns premium_family when subscription_tier signal is premium_family", () => {
    expect(
      getCurrentSubscriptionTier([{ topic: "subscription_tier", value: "premium_family" }]),
    ).toBe("premium_family");
  });
  it("returns premium_annual when signal is premium_annual", () => {
    expect(
      getCurrentSubscriptionTier([{ topic: "subscription_tier", value: "premium_annual" }]),
    ).toBe("premium_annual");
  });
  it("returns premium_monthly when signal is premium_monthly", () => {
    expect(
      getCurrentSubscriptionTier([{ topic: "subscription_tier", value: "premium_monthly" }]),
    ).toBe("premium_monthly");
  });
  it("falls back to premium_monthly for legacy entitlement=premium signal", () => {
    expect(
      getCurrentSubscriptionTier([{ topic: "entitlement", value: "premium" }]),
    ).toBe("premium_monthly");
  });
  it("returns free with no signals", () => {
    expect(getCurrentSubscriptionTier([])).toBe("free");
  });
  it("premium_family takes precedence over other signals", () => {
    expect(
      getCurrentSubscriptionTier([
        { topic: "entitlement", value: "premium" },
        { topic: "subscription_tier", value: "premium_family" },
      ]),
    ).toBe("premium_family");
  });
});

describe("isPremium", () => {
  it("is true for family tier via entitlement=premium signal", () => {
    // The webhook writes entitlement=premium for all paid tiers including family
    expect(isPremium([{ topic: "entitlement", value: "premium" }])).toBe(true);
  });
});

describe("SUBSCRIPTION_PLANS", () => {
  it("has 4 entries including premium_family", () => {
    expect(SUBSCRIPTION_PLANS).toHaveLength(4);
    expect(SUBSCRIPTION_PLANS.map((p) => p.tier)).toContain("premium_family");
  });
  it("premium_family has correct pricing", () => {
    const familyPlan = SUBSCRIPTION_PLANS.find((p) => p.tier === "premium_family");
    expect(familyPlan?.priceMonthCents).toBe(999);
    expect(familyPlan?.priceAnnualCents).toBe(7999);
    expect(familyPlan?.trialDays).toBe(7);
  });
});
