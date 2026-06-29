/**
 * The E2E rate-limit bypass (`RATE_LIMIT_DISABLED=1`) disables abuse protection so the self-seeding
 * journey suite isn't throttled from one CI runner IP. It is **TEST/CI ONLY**. If it is ever set in a
 * real PRODUCTION runtime it must FAIL CLOSED (throw at boot) rather than silently leave the live
 * platform with NO rate limiting.
 *
 * Allowed: CI (`CI=true`) and non-production runtimes. HARD-REFUSED (throws): Vercel production
 * (`VERCEL_ENV=production`) and any other `NODE_ENV=production` runtime that isn't CI. (CI runs the
 * app via `next start`, so `NODE_ENV=production` is expected there — hence the `CI` carve-out.)
 */
export function rateLimitBypassActive(env: {
  RATE_LIMIT_DISABLED?: string;
  CI?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
}): boolean {
  if (env.RATE_LIMIT_DISABLED !== "1") return false; // default + production: limiter is ON
  const isCI = env.CI === "true" || env.CI === "1";
  const isProdRuntime = env.VERCEL_ENV === "production" || (env.NODE_ENV === "production" && !isCI);
  if (isProdRuntime) {
    throw new Error(
      "RATE_LIMIT_DISABLED is set in a PRODUCTION runtime — refusing to boot. This bypass is TEST/CI " +
        "ONLY; never set it on the live platform (it would disable abuse protection).",
    );
  }
  return true; // ephemeral CI / local test only
}
