/**
 * H8 — Waitlist double-opt-in tokens.
 *
 * A signed (HMAC-SHA256) confirmation token derived from the email address, so we can
 * verify a confirmation click without storing a per-row secret. Mirrors the unsubscribe
 * token pattern in `@gm/core/email`.
 *
 * The token authenticates the confirmation link only; it is NOT a session credential.
 * Uses WAITLIST_OPTIN_SECRET (falls back to EMAIL_UNSUBSCRIBE_SECRET, then a dev-only
 * fallback) so a missing dedicated secret degrades gracefully in dev.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resolves the HMAC signing secret for waitlist double-opt-in confirmation tokens.
 *
 * FAILS CLOSED in a real production runtime: the dev fallback below is a PUBLIC constant (it lives in
 * this open-source repo), so signing with it in prod would make confirmation tokens forgeable. When
 * neither `WAITLIST_OPTIN_SECRET` nor `EMAIL_UNSUBSCRIBE_SECRET` is set in production we throw rather
 * than silently sign with the public fallback (§28: never a synthetic-green). Mirrors the
 * `isProdRuntime` guard in `security/rate-limit-guard.ts`. CI + non-production keep the dev fallback.
 */
export function resolveOptinSecret(
  env: {
    WAITLIST_OPTIN_SECRET?: string;
    EMAIL_UNSUBSCRIBE_SECRET?: string;
    CI?: string;
    VERCEL_ENV?: string;
    NODE_ENV?: string;
  } = process.env,
): string {
  const secret = env.WAITLIST_OPTIN_SECRET?.trim() || env.EMAIL_UNSUBSCRIBE_SECRET?.trim();
  if (secret) return secret;
  const isCI = env.CI === "true" || env.CI === "1";
  const isProdRuntime = env.VERCEL_ENV === "production" || (env.NODE_ENV === "production" && !isCI);
  if (isProdRuntime) {
    throw new Error(
      "WAITLIST_OPTIN_SECRET (or EMAIL_UNSUBSCRIBE_SECRET) is required in production — refusing to " +
        "sign double-opt-in tokens with the public dev fallback (they would be forgeable). Set it in " +
        "the environment (see PENDING_OPS.md).",
    );
  }
  return "gm-optin-fallback-secret-do-not-use-in-prod";
}

function getOptinSecret(): string {
  return resolveOptinSecret(process.env);
}

function normalize(email: string): string {
  return email.toLowerCase().trim();
}

/** Generate the double-opt-in confirmation token for an email (HMAC-SHA256, hex). */
export function generateConfirmToken(email: string): string {
  return createHmac("sha256", getOptinSecret()).update(normalize(email)).digest("hex");
}

/** Verify a confirmation token (timing-safe). Returns false on any malformed input. */
export function verifyConfirmToken(email: string, token: string | null | undefined): boolean {
  if (typeof token !== "string" || token.length === 0) return false;
  const expected = generateConfirmToken(email);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(token, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
