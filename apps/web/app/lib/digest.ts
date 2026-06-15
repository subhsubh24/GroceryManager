import { getPantryView, loadReorderInputs, loadWrappedInputs, type Querier } from "@gm/db";
import { selectExpiringSoon } from "@gm/core/pantry";
import { predictReorder } from "@gm/core/reorder";
import { buildDigest, type DigestSummary } from "@gm/core/digest";

/**
 * Compose a user's weekly digest from the engines already built (expiring + reorder-due + spend +
 * cooked). Shared by the /digest page and the push cron so the briefing and the notification can't
 * drift. Must run inside withTenant (RLS-scoped reads).
 */
export async function buildDigestForUser(
  tx: Querier,
  userId: string,
  now = new Date(),
): Promise<DigestSummary> {
  const pantry = await getPantryView(tx, userId);
  const reorder = await loadReorderInputs(tx, userId);
  const wrapped = await loadWrappedInputs(tx, userId, 7);

  const expiring = selectExpiringSoon(pantry, { domain: "grocery", withinDays: 5 }).map((e) => ({
    name: e.name,
    reason: e.reason,
    daysLeft: e.daysLeft,
  }));

  const reorderDue = reorder
    .map((r) => ({
      r,
      pred: predictReorder(
        {
          baseQtyOnHand: r.baseQtyOnHand,
          estimatedConsumptionRatePerDay: r.ratePerDay,
          confidence: r.confidence,
        },
        {
          enabled: r.enabled ?? false,
          targetParQty: r.targetParQty,
          reorderPointQty: r.reorderPointQty,
          leadTimeDays: r.leadTimeDays ?? 2,
          minIntervalDays: r.minIntervalDays ?? 7,
        },
        { asOf: now },
      ),
    }))
    .filter((x) => x.pred.shouldReorder)
    .map((x) => ({
      name: x.r.name,
      recommendQty: x.pred.recommendQty,
      recommendByDate: x.pred.recommendByDate,
    }));

  return buildDigest({
    expiring,
    reorderDue,
    spentThisWeekCents: wrapped.purchases.reduce((s, p) => s + (p.totalCents ?? 0), 0),
    homeCookedThisWeek: wrapped.mealLogs.length,
  });
}
