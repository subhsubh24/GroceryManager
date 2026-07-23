import { getDb, getPantryView, withTenant } from "@gm/db";
import { toMobilePantryItems } from "@gm/core/pantry";
import { verifyMobileToken } from "../_lib";
import { serverError } from "../../_lib/guard";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return Response.json({ error: "Authorization header required" }, { status: 401 });
  }

  const userId = verifyMobileToken(token);
  if (!userId) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const rl = rateLimit(`pantry-read:${userId}`, 60, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  try {
    const rows = await withTenant(getDb(), userId, (tx) => getPantryView(tx, userId));
    return Response.json({ items: toMobilePantryItems(rows) });
  } catch (err) {
    return serverError("mobile/pantry", err);
  }
}
