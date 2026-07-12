/**
 * OAuth token-encryption enforcement classifier.
 *
 * When a user signs in with Google (or clicks "Connect Gmail"), the provider grants access/refresh
 * tokens that we must encrypt-at-rest with `TOKEN_ENC_KEY` before storing (they authorize reading the
 * user's Gmail for receipt import — a Premium feature). When that key is ABSENT we deliberately store
 * `null` rather than a plaintext token — storing an unencrypted OAuth token would be strictly worse.
 *
 * But storing `null` SILENTLY turns a misconfiguration into an invisible failure: the connect flow
 * "succeeds", yet Gmail sync later fails with a cryptic "no valid google token". Per §28 (never a
 * synthetic-green) the caller must, in a real production runtime, log this LOUDLY so the owner sees
 * the gap and sets the key — exactly mirroring the captcha fail-OPEN-but-LOUD posture
 * (`captcha-guard.ts`, §32): we never hard-block sign-in over a missing hardening/config key, we make
 * the misconfiguration VISIBLE.
 *
 * Pure + env-injected so it is unit-testable with no secret (mirrors `captcha-guard.ts` /
 * `rate-limit-guard.ts`).
 */
export interface TokenEncryptionStatus {
  /** True when a key is configured — the caller SHOULD encrypt + store the granted OAuth tokens. */
  willEncrypt: boolean;
  /**
   * True when Google granted a token but `TOKEN_ENC_KEY` is absent in a real production runtime — a
   * live gap (tokens can't be stored, so Gmail receipt import silently won't work). The caller logs
   * this LOUDLY. False when there is no token to store (nothing to encrypt → no gap) or outside prod.
   */
  missingInProd: boolean;
}

export function tokenEncryptionStatus(input: {
  /** Google granted an access and/or refresh token that we would otherwise store. */
  hasToken: boolean;
  env: {
    TOKEN_ENC_KEY?: string;
    CI?: string;
    VERCEL_ENV?: string;
    NODE_ENV?: string;
  };
}): TokenEncryptionStatus {
  const hasKey = (input.env.TOKEN_ENC_KEY?.trim().length ?? 0) > 0;
  if (hasKey) return { willEncrypt: true, missingInProd: false };
  // No key: nothing to store means no gap; only a granted-but-unstorable token is a live prod gap.
  if (!input.hasToken) return { willEncrypt: false, missingInProd: false };
  const isCI = input.env.CI === "true" || input.env.CI === "1";
  const isProdRuntime =
    input.env.VERCEL_ENV === "production" || (input.env.NODE_ENV === "production" && !isCI);
  return { willEncrypt: false, missingInProd: isProdRuntime };
}
