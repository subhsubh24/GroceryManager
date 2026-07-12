import { describe, it, expect } from "vitest";
import { tokenEncryptionStatus } from "./token-enc-guard";

describe("tokenEncryptionStatus", () => {
  it("encrypts when a key is set (regardless of runtime)", () => {
    expect(
      tokenEncryptionStatus({ hasToken: true, env: { TOKEN_ENC_KEY: "k", VERCEL_ENV: "production" } }),
    ).toEqual({ willEncrypt: true, missingInProd: false });
    expect(
      tokenEncryptionStatus({ hasToken: false, env: { TOKEN_ENC_KEY: "k" } }),
    ).toEqual({ willEncrypt: true, missingInProd: false });
  });

  it("treats a blank/whitespace key as unset", () => {
    expect(tokenEncryptionStatus({ hasToken: true, env: { TOKEN_ENC_KEY: "   " } }).willEncrypt).toBe(
      false,
    );
  });

  it("no token to store → no gap, even in prod with no key", () => {
    // A cold Google sign-in that returns no access/refresh token has nothing to encrypt: not a gap.
    expect(
      tokenEncryptionStatus({ hasToken: false, env: { VERCEL_ENV: "production" } }),
    ).toEqual({ willEncrypt: false, missingInProd: false });
  });

  it("granted token + missing key in a Vercel production runtime → loud gap", () => {
    expect(
      tokenEncryptionStatus({ hasToken: true, env: { VERCEL_ENV: "production" } }),
    ).toEqual({ willEncrypt: false, missingInProd: true });
  });

  it("granted token + missing key with NODE_ENV=production (non-CI) → loud gap", () => {
    expect(
      tokenEncryptionStatus({ hasToken: true, env: { NODE_ENV: "production" } }).missingInProd,
    ).toBe(true);
  });

  it("CI carve-out: NODE_ENV=production under CI is NOT a prod gap (next start in CI)", () => {
    // CI runs the app via `next start` (NODE_ENV=production) — must not be flagged as a live gap.
    expect(
      tokenEncryptionStatus({ hasToken: true, env: { NODE_ENV: "production", CI: "true" } })
        .missingInProd,
    ).toBe(false);
    expect(
      tokenEncryptionStatus({ hasToken: true, env: { NODE_ENV: "production", CI: "1" } })
        .missingInProd,
    ).toBe(false);
  });

  it("dev/local (no prod signal) with a granted token but no key → not flagged", () => {
    expect(
      tokenEncryptionStatus({ hasToken: true, env: { NODE_ENV: "development" } }).missingInProd,
    ).toBe(false);
    expect(tokenEncryptionStatus({ hasToken: true, env: {} }).missingInProd).toBe(false);
  });
});
