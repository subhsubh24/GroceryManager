/**
 * PUBLIC beta INVITE-CODE redeem endpoint (ROADMAP §34 Part B).
 *
 * A waitlisted person enters the code the owner issued them at `/join`. A valid code is their beta
 * KEY: on success we grant the pre-launch SITE-GATE cookie (so the next hop, `/signup`, is reachable
 * even though it's otherwise gated) and tell the client to continue to signup. The full app stays
 * gated for anyone without a code.
 *
 * Hardened like the other public surface (Track G), in order:
 *   1. per-IP rate limit          — brute-forcing a 50-bit code is already infeasible; this closes it
 *   2. bounded input              — a code is tiny; reject anything oversized before touching the DB
 *   3. normalize + format-check   — @gm/core/security/invite-code (unit-tested); reject early, keyless
 *   4. idempotent DB redeem       — admin client; a per-person key re-redeems safely
 *   5. grant the gate cookie      — only the SITE_GATE cookie, only when a password is configured
 *
 * Error hygiene: an invalid code, a malformed code, and a not-found code ALL return the SAME generic
 * message — no enumeration of which codes exist, no DB internals. Redemption is idempotent, so this
 * never leaks "already used" either.
 */
import { NextResponse } from "next/server";
import { getAdminDb, redeemWaitlistInvite } from "@gm/db";
import { normalizeAndValidate } from "@gm/core/security/invite-code";
import { rateLimit, tooManyRequests } from "@/app/api/_lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_GATE_COOKIE = "gm_site_gate";
const MAX_CODE_CHARS = 64; // a code is 10 chars; anything longer is junk/abuse — reject unread
const GENERIC = "That invite code isn't valid. Check the code from your invite email and try again.";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: Request): Promise<Response> {
  const ip = clientIp(req);

  // 1. Per-IP rate limit — a hard cap on code-guessing regardless of entropy.
  const rl = rateLimit(`invite-redeem:${ip}`, 5, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  // 2. Bounded input.
  let raw: unknown;
  try {
    const body = (await req.json()) as { code?: unknown };
    raw = body.code;
  } catch {
    return NextResponse.json({ error: "Couldn't read that request. Please try again." }, { status: 400 });
  }
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_CODE_CHARS) {
    return NextResponse.json({ error: GENERIC }, { status: 400 });
  }

  // 3. Normalize + validate shape BEFORE any DB work (keyless, cheap, no enumeration).
  const code = normalizeAndValidate(raw);
  if (!code) {
    return NextResponse.json({ error: GENERIC }, { status: 400 });
  }

  // 4. Idempotent redeem (admin client). Any DB failure degrades to the same generic message.
  let redeemed: { email: string } | null;
  try {
    redeemed = await redeemWaitlistInvite(getAdminDb(), code);
  } catch (err) {
    console.error("[invite/redeem] failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Something went wrong redeeming that code. Please try again in a moment." },
      { status: 500 },
    );
  }
  if (!redeemed) {
    return NextResponse.json({ error: GENERIC }, { status: 404 });
  }

  // 5. Grant the SITE-GATE cookie so /signup is reachable. Only meaningful when the gate is ON
  //    (a password is configured); when it's OFF (dev / post-launch) this is a harmless no-op and
  //    /signup is already public.
  const res = NextResponse.json({ ok: true, next: "/signup?invited=1" });
  const password = process.env.SITE_GATE_PASSWORD;
  if (password) {
    res.cookies.set(SITE_GATE_COOKIE, password, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}

// Only POST is meaningful; make other verbs explicit 405s rather than Next's default handling.
export function GET(): Response {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
