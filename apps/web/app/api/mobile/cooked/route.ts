import { getDb, loadCookLog, withTenant } from "@gm/db";
import { verifyMobileToken } from "../_lib";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });
  const userId = verifyMobileToken(token);
  if (!userId) return Response.json({ error: "Invalid or expired token" }, { status: 401 });

  const rl = rateLimit(`cooked-read:${userId}`, 60, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  try {
    const meals = await withTenant(getDb(), userId, (tx) => loadCookLog(tx, userId));
    return Response.json({
      meals: meals.map((m) => ({
        id: m.id,
        title: m.title,
        imageUrl: m.imageUrl,
        cookedAt: m.cookedAt.toISOString(),
        servingsMade: m.servingsMade,
        kcal: m.kcal,
        proteinG: m.proteinG,
        carbsG: m.carbsG,
        fatG: m.fatG,
      })),
    });
  } catch {
    return Response.json({ error: "Failed to load cook log" }, { status: 500 });
  }
}
