import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateConfirmToken, verifyConfirmToken, resolveOptinSecret } from "./optin.js";

describe("waitlist double-opt-in tokens", () => {
  const orig = process.env["WAITLIST_OPTIN_SECRET"];
  beforeEach(() => {
    process.env["WAITLIST_OPTIN_SECRET"] = "test-secret-123";
  });
  afterEach(() => {
    if (orig === undefined) delete process.env["WAITLIST_OPTIN_SECRET"];
    else process.env["WAITLIST_OPTIN_SECRET"] = orig;
  });

  it("round-trips a valid token", () => {
    const t = generateConfirmToken("Hi@Example.com");
    expect(verifyConfirmToken("hi@example.com", t)).toBe(true);
  });

  it("is case- and whitespace-insensitive on the email", () => {
    const t = generateConfirmToken("  user@x.com  ");
    expect(verifyConfirmToken("USER@X.COM", t)).toBe(true);
  });

  it("rejects a token for a different email", () => {
    const t = generateConfirmToken("a@x.com");
    expect(verifyConfirmToken("b@x.com", t)).toBe(false);
  });

  it("rejects empty / malformed / non-hex tokens", () => {
    expect(verifyConfirmToken("a@x.com", "")).toBe(false);
    expect(verifyConfirmToken("a@x.com", null)).toBe(false);
    expect(verifyConfirmToken("a@x.com", undefined)).toBe(false);
    expect(verifyConfirmToken("a@x.com", "not-hex-zzz")).toBe(false);
  });

  it("rejects a token signed under a different secret", () => {
    const t = generateConfirmToken("a@x.com");
    process.env["WAITLIST_OPTIN_SECRET"] = "different-secret";
    expect(verifyConfirmToken("a@x.com", t)).toBe(false);
  });
});

describe("resolveOptinSecret — required in prod, dev fallback elsewhere", () => {
  it("prefers WAITLIST_OPTIN_SECRET, then EMAIL_UNSUBSCRIBE_SECRET (any runtime)", () => {
    expect(
      resolveOptinSecret({ WAITLIST_OPTIN_SECRET: "wl", EMAIL_UNSUBSCRIBE_SECRET: "un", VERCEL_ENV: "production" }),
    ).toBe("wl");
    expect(resolveOptinSecret({ EMAIL_UNSUBSCRIBE_SECRET: "un", VERCEL_ENV: "production" })).toBe("un");
    expect(resolveOptinSecret({ WAITLIST_OPTIN_SECRET: "  wl  " })).toBe("wl");
  });

  it("returns the dev fallback in a non-production runtime", () => {
    expect(resolveOptinSecret({ NODE_ENV: "test" })).toMatch(/do-not-use-in-prod/);
    expect(resolveOptinSecret({ NODE_ENV: "development" })).toMatch(/do-not-use-in-prod/);
  });

  it("allows the fallback in CI even when NODE_ENV=production (next start under CI)", () => {
    expect(resolveOptinSecret({ NODE_ENV: "production", CI: "true" })).toMatch(/do-not-use-in-prod/);
  });

  it("THROWS in a Vercel production runtime (never sign with the public fallback)", () => {
    expect(() => resolveOptinSecret({ VERCEL_ENV: "production" })).toThrow(/required in production/);
  });

  it("THROWS in NODE_ENV=production outside CI", () => {
    expect(() => resolveOptinSecret({ NODE_ENV: "production" })).toThrow(/required in production/);
  });
});
