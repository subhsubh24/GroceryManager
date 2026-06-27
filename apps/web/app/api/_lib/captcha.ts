/**
 * G5: Cloudflare Turnstile captcha verification.
 *
 * Fail-open when CLOUDFLARE_TURNSTILE_SECRET_KEY is not set (dev/staging).
 * In production, set the key to enforce bot protection on public forms.
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
    });
    const data = (await res.json()) as { success?: boolean };
    return { success: data.success === true, skipped: false };
  } catch {
    // Network error verifying captcha — fail-open to avoid blocking legitimate users
    console.warn("[captcha] Turnstile verification request failed — allowing through");
    return { success: true, skipped: true };
  }
}
