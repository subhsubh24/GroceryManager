import { describe, expect, it } from "vitest";
import { buildDigestNotification, buildDigestSms } from "./notify.js";
import type { DigestSummary } from "../digest/build.js";

const base: DigestSummary = {
  headline: "2 to reorder · 1 expiring soon.",
  subline: "You cooked 3 meals this week · $42.00 spent.",
  expiringCount: 1,
  reorderCount: 2,
  spentThisWeekCents: 4200,
  homeCookedThisWeek: 3,
  topExpiring: [],
  topReorder: [
    { name: "whole milk", recommendQty: 1, recommendByDate: null },
    { name: "eggs", recommendQty: 1, recommendByDate: null },
  ],
  nextRunOutAt: null,
  isQuiet: false,
};

describe("buildDigestNotification", () => {
  it("maps headline/subline → a notification pointing at the digest", () => {
    expect(buildDigestNotification(base)).toEqual({
      title: "2 to reorder · 1 expiring soon.",
      body: "You cooked 3 meals this week · $42.00 spent.",
      url: "/digest",
    });
  });

  it("returns null on a quiet week (don't nag)", () => {
    expect(buildDigestNotification({ ...base, isQuiet: true })).toBeNull();
  });
});

describe("buildDigestSms", () => {
  it("includes the headline, the items to get, and a list link when an app URL is set", () => {
    const sms = buildDigestSms(base, "https://app.example.com/");
    expect(sms).toContain("2 to reorder · 1 expiring soon.");
    expect(sms).toContain("Need: Whole Milk, Eggs.");
    expect(sms).toContain("https://app.example.com/list"); // trailing slash collapsed
  });

  it("omits the link when no app URL is configured", () => {
    expect(buildDigestSms(base)).not.toContain("http");
  });

  it("returns null on a quiet week", () => {
    expect(buildDigestSms({ ...base, isQuiet: true })).toBeNull();
  });
});
