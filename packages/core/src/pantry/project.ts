/**
 * Ledger → PantryStock projection (PLAN §6). Pure mapping from a `DepletionInput`
 * to the fields a `pantry_stock` row carries; the DB adapter just upserts this.
 */
import { estimateOnHand, type DepletionInput, type StockStatus } from "./depletion.js";

export interface PantryProjection {
  baseQtyOnHand: number;
  status: StockStatus;
  confidence: number;
  estimatedRunOutAt: Date | null;
  estimatedConsumptionRatePerDay: number | null;
}

export function projectPantryStock(input: DepletionInput): PantryProjection {
  const r = estimateOnHand(input);
  return {
    baseQtyOnHand: r.baseQtyOnHand,
    status: r.status,
    confidence: r.confidence,
    estimatedRunOutAt: r.estimatedRunOutAt,
    estimatedConsumptionRatePerDay: input.ratePerDay ?? null,
  };
}
