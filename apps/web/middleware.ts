import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { siteGateDecision } from "@gm/core/security/site-gate";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const SITE_GATE_COOKIE = "gm_site_gate";

/**
 * Pre-launch SITE GATE. When `SITE_GATE_PASSWORD` is set, password-protect the deployed app but
 * EXEMPT the public marketing/waitlist surface (so people can still join the waitlist) — pure
 * route/decision logic lives in `@gm/core/security/site-gate`. Set the password pre-launch and
 * UNSET it at launch to open the app (PENDING_OPS owner action). Returns a Response when it should
 * short-circuit the request, or `undefined` to fall through to the normal auth logic.
 *
 * Edge runtime reads `process.env` directly (the zod env loader isn't edge-safe and this var is
 * optional — gate is simply OFF when unset).
 */
function siteGate(req: Request, pathname: string, search: string): Response | undefined {
  const password = process.env.SITE_GATE_PASSWORD;
  // A DISTINCT beta-invite secret the gate ALSO accepts (granted by /api/invite/redeem), so invitees
  // never receive the master password. Optional — absent → only the password unlocks the gate.
  const inviteSecret = process.env.SITE_GATE_INVITE_SECRET;
  const cookie = (req as { cookies?: { get(name: string): { value: string } | undefined } }).cookies?.get(
    SITE_GATE_COOKIE,
  )?.value;

  // A `?gate=...` query unlocks the gate by setting the cookie, then redirects to the clean URL. This
  // path is the human-typed master password only (invitees use /join), so it never sets the cookie
  // to the invite secret.
  const url = new URL(req.url);
  const provided = url.searchParams.get("gate");
  if (password && provided !== null) {
    if (siteGateDecision({ pathname, password, cookie: provided }) === "authorized") {
      url.searchParams.delete("gate");
      const res = NextResponse.redirect(url);
      res.cookies.set(SITE_GATE_COOKIE, provided, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }
  }

  const decision = siteGateDecision({ pathname, password, cookie, inviteSecret });
  if (decision === "off" || decision === "exempt" || decision === "authorized") return undefined;
  return challengePage(provided !== null);
}

/** Minimal, on-brand-neutral password prompt served when the gate is locked. */
function challengePage(failed: boolean): Response {
  const note = failed
    ? '<p class="err">Incorrect password.</p>'
    : "<p>This app is in private pre-launch. Enter the access password, or join the waitlist on the home page.</p>";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/><title>Private pre-launch</title>
<style>:root{color-scheme:light dark}body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100dvh;margin:0;padding:1.5rem}main{max-width:24rem;width:100%}h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#666;line-height:1.5}.err{color:#c0392b}form{display:flex;gap:.5rem;margin-top:1rem}input{flex:1;padding:.6rem .75rem;border:1px solid #ccc;border-radius:.5rem;font-size:1rem}button{padding:.6rem 1rem;border:0;border-radius:.5rem;background:#111;color:#fff;font-size:1rem;cursor:pointer}a{color:inherit}</style>
</head><body><main><h1>Private pre-launch</h1>${note}
<form method="GET"><input name="gate" type="password" placeholder="Access password" autofocus aria-label="Access password"/><button type="submit">Enter</button></form>
<p style="margin-top:1rem"><a href="/">← Join the waitlist</a></p></main></body></html>`;
  return new NextResponse(html, {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * Routes reachable WITHOUT an account: the landing page, public recipe-share pages, NextAuth's own
 * routes, and the secret/OIDC-guarded webhook + cron endpoints. Everything else requires sign-in,
 * so each person uses their own isolated account (RLS-scoped per user).
 */
const PUBLIC = [
  /^\/$/,
  // Public, no-account "try the aha" demo (§34) + its hardened parse endpoint. Drives the waitlist;
  // the full app stays gated. Scoped to the EXACT demo route — never blanket-expose /api/public/*,
  // so a future route under that namespace isn't silently made public. The route self-hardens
  // (rate limit + per-IP/global spend ceiling + captcha).
  /^\/demo(\/|$)/,
  /^\/api\/public\/parse-receipt(\/|$)/,
  // Gated-beta (§34 Part B): the invite-code redeem page + its endpoint. A waitlisted person with a
  // code must reach these WITHOUT an account; redeeming grants the gate cookie → /signup. Scoped to
  // the EXACT routes — never blanket-expose /api/invite/*.
  /^\/join(\/|$)/,
  /^\/api\/invite\/redeem(\/|$)/,
  /^\/signin(\/|$)/,
  /^\/signup(\/|$)/,
  /^\/share(\/|$)/,
  /^\/blog(\/|$)/,
  /^\/help(\/|$)/,
  /^\/privacy(\/|$)/,
  /^\/terms(\/|$)/,
  /^\/sitemap\.xml$/,
  /^\/robots\.txt$/,
  /^\/api\/auth(\/|$)/,
  /^\/api\/webhooks(\/|$)/,
  /^\/api\/cron(\/|$)/,
  // Public waitlist double-opt-in confirm link (verifies its own HMAC token).
  // Scoped to /confirm only — never blanket-expose future /api/waitlist/* routes.
  /^\/api\/waitlist\/confirm(\/|$)/,
  // CAN-SPAM unsubscribe link from lifecycle emails (verifies its own HMAC token; no session).
  /^\/api\/email\/unsubscribe(\/|$)/,
  // Growth read-APIs (self-authz: admin session OR CRON_SECRET bearer — the headless Growth
  // Agent has no session cookie, so it must bypass the sign-in redirect). Scoped to the exact
  // paths — never blanket-expose /api/growth/*.
  /^\/api\/growth\/snapshot(\/|$)/,
  /^\/api\/growth\/analytics(\/|$)/,
];

export default auth((req) => {
  const { pathname, search } = req.nextUrl;

  // Pre-launch SITE GATE runs first — it can password-protect the whole app (signed-in or not),
  // exempting the public waitlist surface so people can still join.
  const gated = siteGate(req, pathname, search);
  if (gated) return gated;

  if (req.auth) return; // signed in
  if (PUBLIC.some((re) => re.test(pathname))) return;
  const url = new URL("/signin", req.nextUrl);
  url.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
});

export const config = {
  // Run on everything except static assets, the service worker, manifest, and icons.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/).*)"],
};
