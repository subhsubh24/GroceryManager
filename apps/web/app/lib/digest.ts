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
  // Optional pre-loaded pantry — pass it when the caller already has the pantry view (e.g. the home
  // page) so we don't run getPantryView twice on the same request.
  pantry?: Awaited<ReturnType<typeof getPantryView>>,
): Promise<DigestSummary> {
  const p = pantry ?? (await getPantryView(tx, userId));
  const [reorder, wrapped] = await Promise.all([
    loadReorderInputs(tx, userId),
    loadWrappedInputs(tx, userId, 7),
  ]);

  const expiring = selectExpiringSoon(p, { domain: "grocery", withinDays: 5, excludeExpired: true }).map((e) => ({
    name: e.name,
    reason: e.reason,
    daysLeft: e.daysLeft,
  }));

  const preds = reorder.map((r) => ({
    r,
    pred: predictReorder(
      {
        baseQtyOnHand: r.baseQtyOnHand,
        estimatedConsumptionRatePerDay: r.ratePerDay,
        confidence: r.confidence,
        dosesPerDay: r.dosesPerDay,
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
  }));

  const reorderDue = preds
    .filter((x) => x.pred.shouldReorder)
    .map((x) => ({
      name: x.r.name,
      recommendQty: x.pred.recommendQty,
      recommendByDate: x.pred.recommendByDate,
    }));

  // Predictive "next grocery run": the soonest FUTURE run-out across everything we track (even items
  // not due yet) — so even when "all stocked up" we can say roughly when the next shop is coming.
  const futureRunOuts = preds
    .map((x) => x.pred.predictedRunOutAt)
    .filter((d): d is Date => d != null && d.getTime() > now.getTime())
    .map((d) => d.getTime());
  const nextRunOutAt = futureRunOuts.length ? new Date(Math.min(...futureRunOuts)) : null;

  return buildDigest({
    expiring,
    reorderDue,
    nextRunOutAt,
    spentThisWeekCents: wrapped.purchases.reduce((s, p) => s + (p.totalCents ?? 0), 0),
    homeCookedThisWeek: wrapped.mealLogs.length,
  });
}
