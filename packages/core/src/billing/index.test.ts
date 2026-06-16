import { describe, expect, it } from "vitest";
import {
  ENTITLEMENT_TOPIC,
  PREMIUM_FEATURES,
  PREMIUM_VALUE,
  canUse,
  isPremium,
} from "./index.js";

describe("isPremium", () => {
  it("is true when an entitlement=premium signal exists", () => {
    expect(isPremium([{ topic: ENTITLEMENT_TOPIC, value: PREMIUM_VALUE }])).toBe(true);
    // tolerant of other signals around it
    expect(
      isPremium([
        { topic: "cuisine:thai", value: "thai" },
        { topic: ENTITLEMENT_TOPIC, value: PREMIUM_VALUE },
      ]),
    ).toBe(true);
  });

  it("is false with no signals, no entitlement, or a non-premium value", () => {
    expect(isPremium([])).toBe(false);
    expect(isPremium([{ topic: "diet:vegan", value: "vegan" }])).toBe(false);
    expect(isPremium([{ topic: ENTITLEMENT_TOPIC, value: "free" }])).toBe(false);
    expect(isPremium([{ topic: ENTITLEMENT_TOPIC, value: null }])).toBe(false);
    // a "premium" value under the wrong topic must not count
    expect(isPremium([{ topic: "other", value: PREMIUM_VALUE }])).toBe(false);
  });
});

describe("canUse", () => {
  it("flag OFF → always allowed (nothing gated), regardless of premium or feature", () => {
    for (const feature of [...PREMIUM_FEATURES, "pantry", "spend", "anything"]) {
      expect(canUse(feature, false, false)).toBe(true); // free user
      expect(canUse(feature, true, false)).toBe(true); // premium user
    }
  });

  it("flag ON + free user → premium features gated, non-premium features allowed", () => {
    for (const feature of PREMIUM_FEATURES) {
      expect(canUse(feature, false, true)).toBe(false);
    }
    for (const feature of ["pantry", "spend", "list", "not_a_premium_feature"]) {
      expect(canUse(feature, false, true)).toBe(true);
    }
  });

  it("flag ON + premium user → everything allowed", () => {
    for (const feature of [...PREMIUM_FEATURES, "pantry", "spend"]) {
      expect(canUse(feature, true, true)).toBe(true);
    }
  });
});
