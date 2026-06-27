import { getDb, getUserBudgetCents, loadLineItemsForSpend, loadPreferenceSignals, loadPurchasesForSpend, withTenant } from "@gm/db";
import { budgetVsActual, spendByPeriod, topItemsBySpend } from "@gm/core/spend";
import { canUse, isPremium } from "@gm/core/billing";
import { verifyMobileToken } from "../_lib";
import { rateLimit, tooManyRequests } from "../_lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });
  const userId = verifyMobileToken(token);
  if (!userId) return Response.json({ error: "Invalid or expired token" }, { status: 401 });

  const rl = rateLimit(`spend:${userId}`, 20, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  try {
    const [signals, purchases, lines, budgetCents] = await withTenant(getDb(), userId, (tx) =>
      Promise.all([
        loadPreferenceSignals(tx, userId),
        loadPurchasesForSpend(tx, userId),
        loadLineItemsForSpend(tx, userId),
        getUserBudgetCents(tx, userId),
      ]),
    );

    const billingOn = process.env.FEATURE_BILLING === "1";
    if (!canUse("spend_insights", isPremium(signals), billingOn)) {
      return Response.json({ upgradeRequired: true });
    }

    const months = spendByPeriod(purchases, "month");
    const weeks = spendByPeriod(purchases, "week");

    return Response.json({
      empty: purchases.length === 0,
      thisMonthCents: months[0]?.totalCents ?? 0,
      months: months.slice(0, 4).map((m) => ({ periodStart: m.periodStart, totalCents: m.totalCents })),
      budget: budgetVsActual(weeks[0]?.totalCents ?? 0, budgetCents),
      top: topItemsBySpend(lines, 8).map((t) => ({ name: t.name, totalCents: t.totalCents })),
    });
  } catch (err) {
    console.error("[mobile/spend]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
