import { describe, it, expect } from "vitest";
import {
  isSiteGateExempt,
  safeEqual,
  siteGateDecision,
  SITE_GATE_EXEMPT,
} from "./site-gate.js";

describe("isSiteGateExempt — public marketing/waitlist + machine endpoints", () => {
  const exempt = [
    "/",
    "/privacy",
    "/privacy/",
    "/terms",
    "/blog",
    "/blog/some-post",
    "/help",
    "/help/faq",
    "/sitemap.xml",
    "/robots.txt",
    "/api/waitlist/confirm",
    "/api/waitlist/confirm/abc",
    "/api/auth/session",
    "/api/webhooks/stripe",
    "/api/cron/digest",
    "/api/growth/snapshot",
    "/api/growth/analytics",
  ];
  for (const p of exempt) {
    it(`exempts ${p}`, () => expect(isSiteGateExempt(p)).toBe(true));
  }

  // Pre-launch we must NOT let people reach the app or create accounts — only the waitlist.
  const gated = [
    "/dashboard",
    "/pantry",
    "/signin",
    "/signup",
    "/share/recipe-123",
    "/api/waitlist", // blanket join API is NOT exempt — only the confirm link is
    "/api/growth/secret",
    "/privacyish", // no false prefix match
  ];
  for (const p of gated) {
    it(`gates ${p}`, () => expect(isSiteGateExempt(p)).toBe(false));
  }
});

describe("safeEqual", () => {
  it("true for equal strings", () => expect(safeEqual("deepster", "deepster")).toBe(true));
  it("false for different values", () => expect(safeEqual("deepster", "deepsteR")).toBe(false));
  it("false for different lengths", () => expect(safeEqual("a", "ab")).toBe(false));
});

describe("siteGateDecision", () => {
  it("off when password unset/empty", () => {
    expect(siteGateDecision({ pathname: "/dashboard", password: "" })).toBe("off");
    expect(siteGateDecision({ pathname: "/dashboard", password: null })).toBe("off");
    expect(siteGateDecision({ pathname: "/dashboard" })).toBe("off");
  });

  it("exempt routes pass even when locked", () => {
    expect(siteGateDecision({ pathname: "/", password: "deepster" })).toBe("exempt");
    expect(siteGateDecision({ pathname: "/api/waitlist/confirm", password: "deepster" })).toBe(
      "exempt",
    );
  });

  it("authorized with the right cookie", () => {
    expect(
      siteGateDecision({ pathname: "/dashboard", password: "deepster", cookie: "deepster" }),
    ).toBe("authorized");
  });

  it("challenge when locked without/with wrong cookie", () => {
    expect(siteGateDecision({ pathname: "/dashboard", password: "deepster" })).toBe("challenge");
    expect(
      siteGateDecision({ pathname: "/dashboard", password: "deepster", cookie: "nope" }),
    ).toBe("challenge");
  });
});

describe("exempt list hygiene", () => {
  it("is non-empty and all RegExp", () => {
    expect(SITE_GATE_EXEMPT.length).toBeGreaterThan(0);
    expect(SITE_GATE_EXEMPT.every((r) => r instanceof RegExp)).toBe(true);
  });
});
