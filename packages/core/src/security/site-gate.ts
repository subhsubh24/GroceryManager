/**
 * Pre-launch SITE GATE — pure path/decision logic.
 *
 * When `SITE_GATE_PASSWORD` is set on the deployed app, the whole app is password-protected
 * EXCEPT the public marketing surface, so people can still join the waitlist / read legal pages
 * without ever reaching the unfinished app. The password VALUE is human-applied (PENDING_OPS):
 * set it pre-launch, UNSET it at launch (every ship-critical QUALITY_SCORECARD dim A/A+ +
 * readiness) to open the app. Never commit the value.
 *
 * This module holds only the framework-agnostic decision so it is unit-tested in the gate.
 * The cookie + HTML-challenge wiring lives in `apps/web/middleware.ts` (edge runtime).
 */

/**
 * Routes reachable even when the gate is LOCKED: the public marketing/waitlist surface plus the
 * machine endpoints that authenticate themselves (cron/webhooks/auth/growth feeds) — the gate
 * must never break those. Scoped precisely; never blanket-expose app routes. `/signin`, `/signup`,
 * `/share`, and every app surface are intentionally NOT here, so no one signs up to a half-baked
 * app pre-launch — all traffic goes to the waitlist on `/`.
 */
export const SITE_GATE_EXEMPT: RegExp[] = [
  /^\/$/, // waitlist / "coming soon" landing (the waitlist join is a server action POSTed here)
  // Public, no-account "try the aha" demo (§34) + its hardened parse endpoint. The demo drives the
  // waitlist; the FULL app stays gated. Scoped to the EXACT demo route — never blanket-expose
  // /api/public/*, so a future route added under that namespace isn't silently made public.
  /^\/demo(\/|$)/,
  /^\/api\/public\/parse-receipt(\/|$)/,
  // Gated-beta (§34 Part B): a waitlisted person with a code must reach the redeem page + endpoint
  // even while the gate is LOCKED — redeeming a valid code is exactly how they're let past it (the
  // route grants the gate cookie on success). Scoped to the EXACT routes; /signup stays gated so
  // only a redeemed invite (or the password) gets in.
  /^\/join(\/|$)/,
  /^\/api\/invite\/redeem(\/|$)/,
  /^\/privacy(\/|$)/, // legal
  /^\/terms(\/|$)/,
  /^\/blog(\/|$)/, // public marketing content
  /^\/help(\/|$)/,
  /^\/sitemap\.xml$/,
  /^\/robots\.txt$/,
  /^\/api\/waitlist\/confirm(\/|$)/, // double-opt-in confirm link (verifies its own HMAC token)
  /^\/api\/auth(\/|$)/, // NextAuth's own routes
  /^\/api\/webhooks(\/|$)/, // provider webhooks (secret/OIDC-guarded)
  /^\/api\/cron(\/|$)/, // scheduled jobs (CRON_SECRET-guarded)
  /^\/api\/growth\/snapshot(\/|$)/, // headless Growth Agent read-APIs (self-authz)
  /^\/api\/growth\/analytics(\/|$)/,
];

export function isSiteGateExempt(pathname: string): boolean {
  return SITE_GATE_EXEMPT.some((re) => re.test(pathname));
}

/** Constant-time string compare — edge-safe (no node:crypto), avoids leaking length via timing. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type SiteGateDecision =
  | "off" // SITE_GATE_PASSWORD unset → gate disabled
  | "exempt" // public marketing/waitlist or machine endpoint → always allowed
  | "authorized" // valid gate cookie → allowed through to normal auth
  | "challenge"; // locked → show the password prompt

/**
 * Decide what to do for one request. Gate is ON whenever `password` (the env var) is non-empty.
 * `cookie` is the value of the gate cookie presented by the client.
 *
 * The gate accepts EITHER the master `password` OR an optional, DISTINCT `inviteSecret`
 * (SITE_GATE_INVITE_SECRET). The invite-code redeem route (§34 Part B) grants the invite secret —
 * NEVER the master password — so a beta invitee's gate cookie never discloses the owner's admin
 * override password: a leaked invitee cookie only exposes the invite secret, which the owner can
 * rotate independently (invitees just re-redeem their still-valid codes) without disturbing the
 * master password or locking out password-holders. Both are compared constant-time.
 */
export function siteGateDecision(opts: {
  pathname: string;
  password?: string | null;
  cookie?: string | null;
  inviteSecret?: string | null;
}): SiteGateDecision {
  const password = opts.password ?? "";
  if (password.length === 0) return "off";
  if (isSiteGateExempt(opts.pathname)) return "exempt";
  const cookie = opts.cookie ?? "";
  if (cookie.length > 0) {
    if (safeEqual(cookie, password)) return "authorized";
    const invite = opts.inviteSecret ?? "";
    if (invite.length > 0 && safeEqual(cookie, invite)) return "authorized";
  }
  return "challenge";
}
