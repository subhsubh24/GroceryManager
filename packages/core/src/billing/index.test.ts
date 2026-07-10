import { describe, expect, it } from "vitest";
import {
  canUse,
  getCurrentSubscriptionTier,
  isPremium,
  isTrialEligible,
  PREMIUM_FEATURES,
  rcEventAction,
  SUBSCRIPTION_PLANS,
  tierFromRevenueCatProduct,
} from "./index.js";

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

describe("isTrialEligible", () => {
  // The 7-day free trial is money-adjacent: mis-classifying a returning subscriber as eligible would
  // silently re-grant a trial they already consumed; mis-classifying a brand-new user as ineligible
  // would withhold the conversion moment. Eligibility keys ONLY on ever having held a paid sub, marked
  // by the presence of a `subscription_renewal_at` signal (written once billing activates).
  it("is true for a brand-new user with no signals", () => {
    expect(isTrialEligible([])).toBe(true);
  });

  it("is true for a free user who has never subscribed (taste/entitlement signals but no renewal)", () => {
    expect(
      isTrialEligible([
        { topic: "cuisine:thai", value: "thai" },
        { topic: "entitlement", value: "free" },
      ]),
    ).toBe(true);
  });

  it("is false once a subscription_renewal_at signal exists (has held a paid sub)", () => {
    expect(isTrialEligible([{ topic: "subscription_renewal_at", value: "2026-08-01T00:00:00.000Z" }])).toBe(false);
  });

  it("is false even after churn — a lapsed subscriber still carries the renewal signal, so no second trial", () => {
    expect(
      isTrialEligible([
        { topic: "entitlement", value: "free" }, // downgraded after cancelling
        { topic: "subscription_renewal_at", value: "2026-01-01T00:00:00.000Z" }, // but the history remains
      ]),
    ).toBe(false);
  });

  it("keys on the renewal signal's PRESENCE, not its value (a null-valued renewal still disqualifies)", () => {
    expect(isTrialEligible([{ topic: "subscription_renewal_at", value: null }])).toBe(false);
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

describe("rcEventAction (RevenueCat event → entitlement effect)", () => {
  it.each([
    "INITIAL_PURCHASE",
    "RENEWAL",
    "PRODUCT_CHANGE",
    "UNCANCELLATION",
    "NON_RENEWING_PURCHASE",
    "SUBSCRIPTION_EXTENDED",
    "TRANSFER",
  ])("grants access on %s", (type) => {
    expect(rcEventAction(type)).toBe("grant");
  });

  it.each(["EXPIRATION", "SUBSCRIPTION_PAUSED"])("revokes access on %s", (type) => {
    expect(rcEventAction(type)).toBe("revoke");
  });

  it.each([
    // CANCELLATION / BILLING_ISSUE keep access until an explicit EXPIRATION — must NOT revoke here.
    "CANCELLATION",
    "BILLING_ISSUE",
    "SUBSCRIBER_ALIAS",
    "TEST",
    "UNKNOWN_FUTURE_EVENT",
    "",
  ])("ignores %s (access unchanged until EXPIRATION)", (type) => {
    expect(rcEventAction(type)).toBe("ignore");
  });

  it("ignores null/undefined event types", () => {
    expect(rcEventAction(null)).toBe("ignore");
    expect(rcEventAction(undefined)).toBe("ignore");
  });
});

describe("tierFromRevenueCatProduct (product id → paid tier)", () => {
  it.each([
    ["gm_family_monthly", "premium_family"],
    ["premium_family_annual", "premium_family"], // family wins over annual (most specific first)
    ["gm_annual", "premium_annual"],
    ["gm_premium_yearly", "premium_annual"], // "year" also maps to annual
    ["gm_monthly", "premium_monthly"],
    ["gm_premium", "premium_monthly"], // no keyword → monthly default
    ["", "premium_monthly"],
  ])("maps %s → %s", (productId, expected) => {
    expect(tierFromRevenueCatProduct(productId)).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(tierFromRevenueCatProduct("GM_FAMILY_ANNUAL")).toBe("premium_family");
    expect(tierFromRevenueCatProduct("Premium_Annual")).toBe("premium_annual");
  });

  it("defaults to monthly for null/undefined", () => {
    expect(tierFromRevenueCatProduct(null)).toBe("premium_monthly");
    expect(tierFromRevenueCatProduct(undefined)).toBe("premium_monthly");
  });
});
