import { getAdminDb, getUserByUsername } from "@gm/db";
import { verifyPasswordConstantTime } from "@gm/core/crypto";
import { normalizeUsername } from "@gm/core/personalization";
import { signMobileToken } from "../_lib";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return Response.json({ error: "Auth not configured" }, { status: 503 });
  }

  // G1/G4: Rate limit auth attempts — 10 per 15 min per IP to prevent brute force
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  const rl = rateLimit(`auth:${ip}`, 10, 15 * 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username =
    typeof (body as Record<string, unknown>).username === "string"
      ? normalizeUsername((body as Record<string, unknown>).username as string)
      : "";
  const password =
    typeof (body as Record<string, unknown>).password === "string"
      ? ((body as Record<string, unknown>).password as string)
      : "";

  if (!username || !password) {
    return Response.json({ error: "username and password are required" }, { status: 400 });
  }

  let user;
  try {
    user = await getUserByUsername(getAdminDb(), username);
  } catch (err) {
    // A DB connectivity failure must not surface as an uncaught 500 with a stack — return a
    // controlled 503 so the mobile client can retry (mirrors /api/v1/auth/token's try/catch).
    // Log server-side (G3 error-hygiene convention) so the failure is diagnosable.
    console.error("[mobile/auth]", err);
    return Response.json({ error: "Auth temporarily unavailable" }, { status: 503 });
  }
  // Constant-work verify FIRST (always runs scrypt) so a non-existent username can't be
  // distinguished from a wrong password by response latency — closes username enumeration.
  if (!verifyPasswordConstantTime(password, user?.passwordHash) || !user) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = signMobileToken(user.id);
  return Response.json({ token, userId: user.id, name: user.name ?? null });
}
