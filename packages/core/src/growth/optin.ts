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

function getOptinSecret(): string {
  return (
    process.env["WAITLIST_OPTIN_SECRET"] ??
    process.env["EMAIL_UNSUBSCRIBE_SECRET"] ??
    "gm-optin-fallback-secret-do-not-use-in-prod"
  );
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
