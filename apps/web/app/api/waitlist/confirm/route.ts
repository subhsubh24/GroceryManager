import { getAdminDb, setWaitlistConfirmed } from "@gm/db";
import { verifyConfirmToken } from "@gm/core/growth/optin";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * H8 — Waitlist double-opt-in confirmation.
 *
 * GET /api/waitlist/confirm?email=<email>&token=<hmac>
 *
 * Public (a visitor clicks this from the confirmation email — no session). The HMAC token is
 * verified server-side, then the signup is marked confirmed (idempotent — double-click safe).
 * Always redirects to the landing page with a result flag; never leaks whether the email was
 * actually on the list (error hygiene — no enumeration).
 */
export async function GET(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  const rl = rateLimit(`waitlist-confirm:${ip}`, 20, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const base = (process.env["APP_URL"] ?? new URL(req.url).origin).replace(/\/$/, "");
  const ok = new URL("/?confirmed=1", base);
  const bad = new URL("/?confirmed=0", base);

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const token = searchParams.get("token");

  if (!email || email.length > 254 || !email.includes("@") || !token) {
    return Response.redirect(bad, 302);
  }
  if (!verifyConfirmToken(email, token)) {
    return Response.redirect(bad, 302);
  }

  try {
    await setWaitlistConfirmed(getAdminDb(), email);
  } catch (err) {
    // Best-effort — log server-side only, never surface DB internals to the visitor.
    console.error("[waitlist/confirm] failed", err instanceof Error ? err.message : String(err));
    return Response.redirect(bad, 302);
  }

  return Response.redirect(ok, 302);
}
