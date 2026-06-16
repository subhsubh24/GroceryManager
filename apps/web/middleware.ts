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
  /^\/share(\/|$)/,
  /^\/api\/auth(\/|$)/,
  /^\/api\/webhooks(\/|$)/,
  /^\/api\/cron(\/|$)/,
];

export default auth((req) => {
  if (req.auth) return; // signed in
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return;
  const url = new URL("/api/auth/signin", req.nextUrl);
  url.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
});

export const config = {
  // Run on everything except static assets, the service worker, manifest, and icons.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/).*)"],
};
