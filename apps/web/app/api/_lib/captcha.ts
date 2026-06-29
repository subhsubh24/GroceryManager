/**
 * G5: Cloudflare Turnstile captcha verification.
 *
 * Fail-open when CLOUDFLARE_TURNSTILE_SECRET_KEY is not set (dev/staging).
 * In production, set the key to enforce bot protection on public forms.
 *
 * A verify-call FAILURE (network error / timeout) is handled by environment: in production we FAIL
 * CLOSED (reject) so an attacker can't bypass bot protection by inducing a timeout against the
 * siteverify endpoint; in dev/staging we fail open so a flaky local network never blocks testing.
 * This mirrors the repo's fail-closed-in-prod posture for other security guards (cron secret,
 * email-capture transport, billing webhooks).
 *
 * Human Core: The owner must create a free Cloudflare account, add a Turnstile site,
 * and set CLOUDFLARE_TURNSTILE_SECRET_KEY + NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY
 * — see PENDING_OPS.md.
 */

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

  // Fail-open when key is absent — dev/staging only
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
