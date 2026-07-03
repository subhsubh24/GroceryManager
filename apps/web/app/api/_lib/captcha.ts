/**
 * G5: Cloudflare Turnstile captcha verification.
 *
 * Enforced only when CLOUDFLARE_TURNSTILE_SECRET_KEY is set. When the key is ABSENT we fail open
 * (skip) so dev/staging never needs a secret — BUT if the key is missing in a real PRODUCTION
 * runtime that is a live bot-protection gap, so we log it LOUDLY rather than skipping silently (§28:
 * never a synthetic-green). We deliberately do NOT reject the submission in that case: captcha guards
 * account creation, and per FACTORY_STANDARD §32 a non-essential side-effect must never hard-block a
 * core user action — a total signup outage would be strictly worse than a logged hardening gap. The
 * classifier `captchaEnforcement` lives in @gm/core so its keyless logic is unit-tested.
 *
 * A verify-call FAILURE (network error / timeout) — key IS configured — is handled by environment: in
 * production we FAIL CLOSED (reject) so an attacker can't bypass bot protection by inducing a timeout
 * against the siteverify endpoint; in dev/staging we fail open so a flaky local network never blocks
 * testing. This mirrors the repo's fail-closed-in-prod posture for other security guards.
 *
 * Human Core: The owner must create a free Cloudflare account, add a Turnstile site,
 * and set CLOUDFLARE_TURNSTILE_SECRET_KEY + NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY
 * — see PENDING_OPS.md.
 */
import { captchaEnforcement } from "@gm/core/security/captcha-guard";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  success: boolean;
  skipped: boolean; // true when key is absent (dev/staging — fail-open)
}

/**
 * Verify a Cloudflare Turnstile token from a form submission.
 * Returns { success: true, skipped: true } when the secret key is not configured.
 */
export async function verifyTurnstile(token: string | null | undefined): Promise<TurnstileResult> {
  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  const enforcement = captchaEnforcement(process.env);

  // Key absent → fail open (skip). In a real production runtime that is a live bot-protection gap,
  // so log LOUDLY (never a silent bypass) — but still fail open, so signup is never hard-blocked (§32).
  if (!enforcement.enforced) {
    if (enforcement.missingInProd) {
      console.error(
        "[captcha] CLOUDFLARE_TURNSTILE_SECRET_KEY is MISSING in a PRODUCTION runtime — bot protection " +
          "on public forms (signup/waitlist) is DISABLED. Set it now to close the gap (see PENDING_OPS.md).",
      );
    }
    return { success: true, skipped: true };
  }

  // `enforcement.enforced` is true only when a non-empty key is set; narrow it for the type checker.
  if (!secretKey) {
    return { success: true, skipped: true };
  }

  // No token submitted — reject
  if (!token) {
    return { success: false, skipped: false };
  }

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
      // Bound the call so a slow (not failed) Cloudflare response can't hang the signup/waitlist
      // serverless function until the platform deadline (a hung form, then a 504). On timeout the
      // catch below decides fail-open vs fail-closed by environment.
      signal: AbortSignal.timeout(3_000),
    });
    const data = (await res.json()) as { success?: boolean };
    return { success: data.success === true, skipped: false };
  } catch {
    // Verify call failed (network error / timeout). The key IS configured, so a bot-protected form
    // is expected here. In production fail CLOSED — otherwise an attacker who induces a timeout
    // bypasses the captcha entirely. In dev/staging fail open so flaky networks don't block testing.
    if (process.env.NODE_ENV === "production") {
      console.warn("[captcha] Turnstile verification failed — rejecting (fail-closed in production)");
      return { success: false, skipped: false };
    }
    console.warn("[captcha] Turnstile verification request failed — allowing through (non-production)");
    return { success: true, skipped: true };
  }
}
