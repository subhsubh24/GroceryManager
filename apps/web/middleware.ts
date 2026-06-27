import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Routes reachable WITHOUT an account: the landing page, public recipe-share pages, NextAuth's own
 * routes, and the secret/OIDC-guarded webhook + cron endpoints. Everything else requires sign-in,
 * so each person uses their own isolated account (RLS-scoped per user).
 */
const PUBLIC = [
  /^\/$/,
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
  // Growth read-APIs (self-authz: admin session OR CRON_SECRET bearer — the headless Growth
  // Agent has no session cookie, so it must bypass the sign-in redirect). Scoped to the exact
  // paths — never blanket-expose /api/growth/*.
  /^\/api\/growth\/snapshot(\/|$)/,
  /^\/api\/growth\/analytics(\/|$)/,
];

export default auth((req) => {
  if (req.auth) return; // signed in
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return;
  const url = new URL("/signin", req.nextUrl);
  url.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
});

export const config = {
  // Run on everything except static assets, the service worker, manifest, and icons.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/).*)"],
};
