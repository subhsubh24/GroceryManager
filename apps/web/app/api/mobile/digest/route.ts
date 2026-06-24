import { getDb, loadCookLog, withTenant } from "@gm/db";
import {
  currentStreak,
  longestStreak,
  cooksThisWeek,
  weeklyActivity,
} from "@gm/core/recipe";
import { verifyMobileToken } from "../_lib";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });
  const userId = verifyMobileToken(token);
  if (!userId) return Response.json({ error: "Invalid or expired token" }, { status: 401 });

  try {
    const meals = await withTenant(getDb(), userId, (tx) => loadCookLog(tx, userId));
    const cookedAt = meals.map((m) => m.cookedAt);
    const now = new Date();

    return Response.json({
      currentStreak: currentStreak(cookedAt, now),
      longestStreak: longestStreak(cookedAt),
      cooksThisWeek: cooksThisWeek(cookedAt, now),
      totalCooks: meals.length,
      weeklyActivity: weeklyActivity(cookedAt, now, 8),
    });
  } catch {
    return Response.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
