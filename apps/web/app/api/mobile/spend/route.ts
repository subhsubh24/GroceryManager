import { getDb, getUserBudgetCents, loadLineItemsForSpend, loadPurchasesForSpend, withTenant } from "@gm/db";
import { budgetVsActual, spendByPeriod, topItemsBySpend } from "@gm/core/spend";
import { verifyMobileToken } from "../_lib";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });
  const userId = verifyMobileToken(token);
  if (!userId) return Response.json({ error: "Invalid or expired token" }, { status: 401 });

  try {
    const [purchases, lines, budgetCents] = await withTenant(getDb(), userId, (tx) =>
      Promise.all([
        loadPurchasesForSpend(tx, userId),
        loadLineItemsForSpend(tx, userId),
        getUserBudgetCents(tx, userId),
      ]),
    );

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
