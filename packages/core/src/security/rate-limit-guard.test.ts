import { describe, it, expect } from "vitest";
import { rateLimitBypassActive } from "./rate-limit-guard.js";

describe("rateLimitBypassActive — TEST/CI only, hard-refuse in prod", () => {
  it("OFF by default (limiter ON) when the flag is unset", () => {
    expect(rateLimitBypassActive({})).toBe(false);
    expect(rateLimitBypassActive({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(false);
    expect(rateLimitBypassActive({ RATE_LIMIT_DISABLED: "0" })).toBe(false);
  });

  it("ALLOWED in CI even though next start sets NODE_ENV=production", () => {
    expect(
      rateLimitBypassActive({ RATE_LIMIT_DISABLED: "1", CI: "true", NODE_ENV: "production" }),
    ).toBe(true);
  });

  it("ALLOWED in local/dev test", () => {
    expect(rateLimitBypassActive({ RATE_LIMIT_DISABLED: "1", NODE_ENV: "development" })).toBe(true);
  });

  it("HARD-REFUSES (throws) on Vercel production", () => {
    expect(() =>
      rateLimitBypassActive({ RATE_LIMIT_DISABLED: "1", VERCEL_ENV: "production" }),
    ).toThrow(/PRODUCTION runtime — refusing to boot/);
  });

  it("HARD-REFUSES (throws) on a non-CI NODE_ENV=production runtime (self-host prod)", () => {
    expect(() =>
      rateLimitBypassActive({ RATE_LIMIT_DISABLED: "1", NODE_ENV: "production" }),
    ).toThrow(/refusing to boot/);
  });
});
