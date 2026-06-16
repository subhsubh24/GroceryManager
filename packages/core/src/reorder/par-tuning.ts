/**
 * Par auto-tuning (PLAN §10 waste-reduction) — when you repeatedly toss an item, the engine should
 * learn to BUY LESS of it. Pure + testable: each waste event lowers the target par (and reorder
 * point) by a step, floored so it never drives the item to zero — you still want *some* on hand.
 * Repeated waste compounds (step applied each time), so the system converges to how much you
 * actually use.
 */
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export interface ParLevels {
  targetParQty: number | null;
  reorderPointQty: number | null;
}

export interface TunedPar {
  targetParQty: number;
  reorderPointQty: number;
}

export interface TuneParOpts {
  /** Multiplier applied per waste event (default 0.75 = buy 25% less). */
  factor?: number;
  /** Never lower the target par below this. */
  minPar?: number;
}

/**
 * Lower an item's par after a waste event. Returns null when there's nothing meaningful to lower
 * (no par set, already at/below the floor, or the step wouldn't change it).
 */
export function tuneParForWaste(current: ParLevels, opts: TuneParOpts = {}): TunedPar | null {
  const factor = opts.factor ?? 0.75;
  const minPar = opts.minPar ?? 1;
  if (current.targetParQty == null || current.targetParQty <= minPar) return null;

  const targetParQty = Math.max(minPar, round3(current.targetParQty * factor));
  if (targetParQty >= current.targetParQty) return null;

  const rpBase = current.reorderPointQty ?? current.targetParQty * 0.5;
  const reorderPointQty = Math.max(0, Math.min(round3(rpBase * factor), targetParQty));

  return { targetParQty, reorderPointQty };
}
