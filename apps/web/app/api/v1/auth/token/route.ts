import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getUserByUsername, getAdminDb } from "@gm/db";
import { verifyPassword } from "@gm/core/crypto";
import { normalizeUsername } from "@gm/core/personalization";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSecret() {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET not set");
  return new TextEncoder().encode(s);
}

export async function POST(req: Request) {
  try {
    // Rate limit credential attempts per IP (Track G G1/G4) — parity with /api/mobile/auth:
    // 10 attempts / 15 min, to blunt brute-force against this 30-day-token mint endpoint.
    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
    const rl = rateLimit(`v1-auth:${ip}`, 10, 15 * 60_000);
    if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

    const body = (await req.json()) as {
      username?: string;
      password?: string;
    };
    const username = normalizeUsername(
      typeof body.username === "string" ? body.username : "",
    );
    const password =
      typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      return NextResponse.json(
        { error: "username and password required" },
        { status: 400 },
      );
    }
    const user = await getUserByUsername(getAdminDb(), username);
    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "invalid credentials" },
        { status: 401 },
      );
    }
    const token = await new SignJWT({ sub: user.id })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("gm-mobile")
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(getSecret());
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
