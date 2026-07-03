import { describe, it, expect } from "vitest";
import { captchaEnforcement } from "./captcha-guard.js";

describe("captchaEnforcement — enforced with a key, loud-in-prod without", () => {
  it("enforces (runs real verification) whenever a key is present, in any runtime", () => {
    expect(captchaEnforcement({ CLOUDFLARE_TURNSTILE_SECRET_KEY: "k", VERCEL_ENV: "production" })).toEqual({
      enforced: true,
      missingInProd: false,
    });
    expect(captchaEnforcement({ CLOUDFLARE_TURNSTILE_SECRET_KEY: "k", NODE_ENV: "development" })).toEqual({
      enforced: true,
      missingInProd: false,
    });
  });

  it("treats a blank/whitespace key as absent", () => {
    expect(captchaEnforcement({ CLOUDFLARE_TURNSTILE_SECRET_KEY: "   ", VERCEL_ENV: "production" })).toEqual({
      enforced: false,
      missingInProd: true,
    });
  });

  it("absent key in a non-production runtime: not enforced, not a prod gap (silent skip)", () => {
    expect(captchaEnforcement({ NODE_ENV: "test" })).toEqual({ enforced: false, missingInProd: false });
    expect(captchaEnforcement({ NODE_ENV: "development" })).toEqual({ enforced: false, missingInProd: false });
  });

  it("absent key in CI (NODE_ENV=production under CI) is not treated as a live prod gap", () => {
    expect(captchaEnforcement({ NODE_ENV: "production", CI: "true" })).toEqual({
      enforced: false,
      missingInProd: false,
    });
  });

  it("absent key in a Vercel production runtime is a live gap the caller must log loud", () => {
    expect(captchaEnforcement({ VERCEL_ENV: "production" })).toEqual({
      enforced: false,
      missingInProd: true,
    });
  });

  it("absent key in NODE_ENV=production outside CI is a live gap", () => {
    expect(captchaEnforcement({ NODE_ENV: "production" })).toEqual({
      enforced: false,
      missingInProd: true,
    });
  });
});
