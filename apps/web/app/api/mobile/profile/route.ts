import { getAdminDb, getDb, getUserById, loadPreferenceSignals, withTenant } from "@gm/db";
import { getCurrentSubscriptionTier, type SubscriptionTier } from "@gm/core/billing";
import { verifyMobileToken } from "../_lib";
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

  const rl = rateLimit(`profile-read:${userId}`, 60, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  // User row (admin scope — reading own row by verified userId)
  let user;
  try {
    user = await getUserById(getAdminDb(), userId);
  } catch (err) {
    // Don't let a DB connectivity failure escape as an uncaught 500 with a stack.
    // Log server-side (G3 error-hygiene convention) so the failure is diagnosable.
    console.error("[mobile/profile]", err);
    return Response.json({ error: "Profile temporarily unavailable" }, { status: 503 });
  }
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // Subscription tier — fail-open: degrade to "free" if the DB read fails
  let tier: SubscriptionTier = "free";
  try {
    const signals = await withTenant(getDb(), userId, (tx) => loadPreferenceSignals(tx, userId));
    tier = getCurrentSubscriptionTier(signals);
  } catch {
    // DB connectivity issue — tier defaults to "free", user still sees profile
  }

  return Response.json({
    name: user.name,
    email: user.email,
    username: user.username,
    tier,
  });
}
