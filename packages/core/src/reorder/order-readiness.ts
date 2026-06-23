/**
 * Order-readiness verdict (PLAN §7.1 — home autopilot). This is a money-adjacent decision rendered
 * on every home load, so it's deliberately RULES over typed signals: honest, instant, reproducible,
 * never a hallucinated "time to order". It still *understands* the list — urgency comes from real
 * run-out dates, and "worth ordering" is a meaningful size, not a single stray add. Pure + tested.
 */
const DAY_MS = 86_400_000;

export type OrderReadiness = "clear" | "building" | "ready" | "urgent";

export interface OrderReadinessInput {
  /** How many items are due to reorder (predicted run-outs). */
  reorderCount: number;
  /** Recommend-by dates for the due items — any subset; the soonest ones drive urgency. */
  dueDates: (Date | null)[];
  /** Unchecked items already on the active shopping list (manual adds / recipe needs). */
  listCount: number;
  now: Date;
  /** A list this size (or larger) is worth ordering even without urgency. */
  readyThreshold?: number;
  /** A recommend-by date within this many days counts as urgent ("time to order"). */
  urgentWithinDays?: number;
}

export interface OrderReadinessResult {
  state: OrderReadiness;
  /** Short, honest headline ("Time to order", "Ready to order", …). */
  headline: string;
  /** One-line reason. */
  reason: string;
  /** Total actionable items (reorder-due + on the list). */
  count: number;
  urgentCount: number;
}

/**
 * Classify the user's grocery run:
 *  - `urgent`   → something runs out within the urgency window → "Time to order".
 *  - `ready`    → a worthwhile-sized list (≥ readyThreshold) → "Ready to order".
 *  - `building` → 1..N items, nothing pressing → quiet "coming together".
 *  - `clear`    → nothing actionable.
 */
export function assessOrderReadiness(input: OrderReadinessInput): OrderReadinessResult {
  const readyThreshold = input.readyThreshold ?? 5;
  const urgentWithinDays = input.urgentWithinDays ?? 3;
  const cutoff = input.now.getTime() + urgentWithinDays * DAY_MS;
  const urgentCount = input.dueDates.filter((d) => d != null && d.getTime() <= cutoff).length;
  const count = Math.max(0, input.reorderCount) + Math.max(0, input.listCount);

  if (count === 0) {
    return {
      state: "clear",
      headline: "You're all stocked up",
      reason: "Nothing's running low right now.",
      count,
      urgentCount,
    };
  }
  if (urgentCount > 0) {
    return {
      state: "urgent",
      headline: "Time to order",
      reason: `${urgentCount} ${urgentCount === 1 ? "item runs" : "items run"} out in the next few days.`,
      count,
      urgentCount,
    };
  }
  if (count >= readyThreshold) {
    return {
      state: "ready",
      headline: "Ready to order",
      reason: `${count} items lined up — worth a single run.`,
      count,
      urgentCount,
    };
  }
  return {
    state: "building",
    headline: "Your list is coming together",
    reason: `${count} ${count === 1 ? "item" : "items"} so far — I'll flag it when it's worth ordering.`,
    count,
    urgentCount,
  };
}
