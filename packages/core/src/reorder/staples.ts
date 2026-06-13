/**
 * Staples autopilot (PLAN §7.1 / §10) — seed a sensible ReorderPolicy from observed cadence so a
 * staple can go "set and forget". Pure + tested; the prediction itself stays in predict.ts.
 */
const DEFAULT_LEAD_DAYS = 2;
const DEFAULT_MIN_INTERVAL = 7;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export interface StapleSeedInput {
  baseQtyOnHand: number;
  /** Learned base-units/day (EWMA); null/0 → fall back to on-hand. */
  ratePerDay: number | null;
}

export interface SeededPolicy {
  targetParQty: number;
  reorderPointQty: number;
  leadTimeDays: number;
  minIntervalDays: number;
}

/**
 * Defaults: keep ~2 weeks of supply (par), reorder when ~lead-time + a few days remain. With no
 * learned rate, fall back to the current on-hand as par and a quarter of that as the trigger.
 */
export function defaultReorderPolicy(input: StapleSeedInput): SeededPolicy {
  const rate = input.ratePerDay && input.ratePerDay > 0 ? input.ratePerDay : null;
  const targetParQty = rate ? round3(rate * 14) : Math.max(1, round3(input.baseQtyOnHand));
  const reorderPointQty = rate
    ? round3(rate * (DEFAULT_LEAD_DAYS + 3))
    : round3(targetParQty * 0.25);
  return {
    targetParQty,
    reorderPointQty,
    leadTimeDays: DEFAULT_LEAD_DAYS,
    minIntervalDays: DEFAULT_MIN_INTERVAL,
  };
}
