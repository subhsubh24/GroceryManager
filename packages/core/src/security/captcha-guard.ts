/**
 * Captcha (Cloudflare Turnstile) enforcement classifier.
 *
 * Turnstile protects the public forms (signup / waitlist) from bots. It is enforced only when
 * `CLOUDFLARE_TURNSTILE_SECRET_KEY` is set. When the key is ABSENT we must not silently pretend the
 * form is protected (§28: never a synthetic-green): in a real production runtime that is a live
 * security gap and the caller logs it LOUDLY so the misconfiguration is visible in prod logs.
 *
 * We deliberately do NOT hard-fail (throw / reject the submission) when the key is missing in prod:
 * captcha guards *account creation*, and per FACTORY_STANDARD §32 a non-essential side-effect must
 * never hard-block a core user action. Rejecting every signup because a bot-protection key is unset
 * would turn a hardening gap into a total signup outage — strictly worse. So the posture is
 * fail-OPEN-but-LOUD: the owner sees the alert and sets the key (a go-live requirement, see
 * PENDING_OPS.md) without the app ever refusing to create accounts.
 *
 * Pure + env-injected so it is unit-testable with no secret (mirrors `rate-limit-guard.ts`).
 */
export interface CaptchaEnforcement {
  /** True when a secret key is configured — the caller should run the real Turnstile verification. */
  enforced: boolean;
  /** True when the key is absent in a real production runtime — a live gap the caller must log loud. */
  missingInProd: boolean;
}

export function captchaEnforcement(env: {
  CLOUDFLARE_TURNSTILE_SECRET_KEY?: string;
  CI?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
}): CaptchaEnforcement {
  const hasKey = (env.CLOUDFLARE_TURNSTILE_SECRET_KEY?.trim().length ?? 0) > 0;
  if (hasKey) return { enforced: true, missingInProd: false };
  const isCI = env.CI === "true" || env.CI === "1";
  const isProdRuntime = env.VERCEL_ENV === "production" || (env.NODE_ENV === "production" && !isCI);
  return { enforced: false, missingInProd: isProdRuntime };
}
