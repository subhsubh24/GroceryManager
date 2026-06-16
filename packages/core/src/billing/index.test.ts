import { describe, expect, it } from "vitest";
import { canUse, isPremium, PREMIUM_FEATURES } from "./index.js";

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
