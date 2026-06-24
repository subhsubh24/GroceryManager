import { getDb, loadPreferenceSignals, loadWrappedInputs, withTenant } from "@gm/db";
import { buildWrapped } from "@gm/core/spend";
import { canUse, isPremium } from "@gm/core/billing";
import { verifyMobileToken } from "../_lib";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });
  const userId = verifyMobileToken(token);
  if (!userId) return Response.json({ error: "Invalid or expired token" }, { status: 401 });

  try {
    const [input, signals] = await withTenant(getDb(), userId, (tx) =>
      Promise.all([loadWrappedInputs(tx, userId), loadPreferenceSignals(tx, userId)]),
    );

    const billingOn = process.env.FEATURE_BILLING === "1";
    if (!canUse("wrapped_plus", isPremium(signals), billingOn)) {
      return Response.json({ upgradeRequired: true });
    }

    const stats = buildWrapped(input);
    return Response.json({ stats });
  } catch (err) {
    console.error("[mobile/wrapped]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
