import { getAdminDb, getUserByUsername } from "@gm/db";
import { verifyPassword } from "@gm/core/crypto";
import { normalizeUsername } from "@gm/core/personalization";
import { signMobileToken } from "../_lib";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return Response.json({ error: "Auth not configured" }, { status: 503 });
  }

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

  const user = await getUserByUsername(getAdminDb(), username);
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = signMobileToken(user.id);
  return Response.json({ token, userId: user.id, name: user.name ?? null });
}
