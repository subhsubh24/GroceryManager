/**
 * Reorder / prediction engine (PLAN §7.1). Pure: given a pantry-stock snapshot + the item's
 * reorder policy, decide whether to reorder now, by when, and how much.
 */
const DAY_MS = 86_400_000;

export interface StockSnapshot {
  baseQtyOnHand: number;
  /** Learned base-units/day (EWMA from depletion); null disables run-out prediction. */
  estimatedConsumptionRatePerDay: number | null;
  confidence: number;
}

export interface ReorderPolicySnapshot {
  enabled: boolean;
  targetParQty: number | null;
  reorderPointQty: number | null;
  leadTimeDays: number;
  minIntervalDays: number;
  lastSuggestedAt?: Date | null;
  /** Round the recommended quantity up to whole packages when known. */
  packageQty?: number | null;
}

export interface ReorderPrediction {
  shouldReorder: boolean;
  predictedRunOutAt: Date | null;
  recommendByDate: Date | null;
  recommendQty: number | null;
  confidence: number;
  rationale: string;
}

export interface PredictOpts {
  asOf?: Date;
  /** Suggest if the order-by date falls within this many days. */
  horizonDays?: number;
}

export function predictReorder(
  stock: StockSnapshot,
  policy: ReorderPolicySnapshot,
  opts: PredictOpts = {},
): ReorderPrediction {
  const asOf = opts.asOf ?? new Date();
  const horizonDays = opts.horizonDays ?? 3;
  const rate = stock.estimatedConsumptionRatePerDay;

  const predictedRunOutAt =
    rate && rate > 0 ? new Date(asOf.getTime() + (stock.baseQtyOnHand / rate) * DAY_MS) : null;
  const recommendByDate = predictedRunOutAt
    ? new Date(predictedRunOutAt.getTime() - policy.leadTimeDays * DAY_MS)
    : null;

  const base: Omit<ReorderPrediction, "shouldReorder" | "rationale"> = {
    predictedRunOutAt,
    recommendByDate,
    recommendQty: recommendQty(stock, policy),
    confidence: stock.confidence,
  };

  if (!policy.enabled) {
    return { ...base, shouldReorder: false, rationale: "reorder disabled for this item" };
  }

  // Don't re-suggest more often than minIntervalDays.
  if (
    policy.lastSuggestedAt &&
    (asOf.getTime() - policy.lastSuggestedAt.getTime()) / DAY_MS < policy.minIntervalDays
  ) {
    return { ...base, shouldReorder: false, rationale: "suggested recently (within min interval)" };
  }

  const belowReorderPoint =
    policy.reorderPointQty != null && stock.baseQtyOnHand <= policy.reorderPointQty;
  const dueByHorizon =
    recommendByDate != null &&
    recommendByDate.getTime() <= asOf.getTime() + horizonDays * DAY_MS;

  if (belowReorderPoint) {
    return { ...base, shouldReorder: true, rationale: "on-hand at/under the reorder point" };
  }
  if (dueByHorizon) {
    return {
      ...base,
      shouldReorder: true,
      rationale: `predicted run-out ${fmt(predictedRunOutAt)} — order by ${fmt(recommendByDate)} to arrive in time`,
    };
  }
  return { ...base, shouldReorder: false, rationale: "sufficient stock for now" };
}

function recommendQty(stock: StockSnapshot, policy: ReorderPolicySnapshot): number | null {
  if (policy.targetParQty == null) return null;
  const needed = Math.max(0, policy.targetParQty - stock.baseQtyOnHand);
  if (needed === 0) return 0;
  if (policy.packageQty && policy.packageQty > 0) {
    return Math.ceil(needed / policy.packageQty) * policy.packageQty;
  }
  return needed;
}

function fmt(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "unknown";
}
