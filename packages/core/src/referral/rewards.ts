/**
 * Referral reward logic (H13 — the recurring-use viral lever).
 *
 * The `?ref=` attribution loop already credits a referrer when a friend joins (see
 * `recordReferral`/`countReferralsJoined` in `@gm/db`). This module turns that raw join count into an
 * EARNED REWARD — free months of Premium at referral milestones — so there is an actual incentive to
 * share. Pure + client-safe (no env, no I/O): the DB layer persists the grants into the append-only
 * `referral_credits` ledger (idempotent per milestone) and Stripe Checkout converts the earned months
 * into bonus free-trial days at the user's first subscription. Margin-bounded: the ladder caps at
 * `MAX_REWARD_MONTHS`, so the most generous outcome is fixed and known.
 */

export interface ReferralMilestone {
  /** Friends joined required to unlock this tier. */
  friends: number;
  /** INCREMENTAL free months granted at this tier (sum across reached tiers = total earned). */
  months: number;
  /** Stable grant key — one immutable `referral_credits.reason` per milestone (idempotent). */
  reason: string;
  /** Human label for the reward UI. */
  label: string;
}

/**
 * The reward ladder. `months` is INCREMENTAL (the bonus added when this tier is first reached), so the
 * total earned = sum of `months` for every reached tier. Cumulative totals: 1 friend → 1 month,
 * 3 friends → 3 months, 5 friends → 6 months. Capped by design (see `MAX_REWARD_MONTHS`).
 */
export const REFERRAL_MILESTONES: readonly ReferralMilestone[] = [
  { friends: 1, months: 1, reason: "milestone_1", label: "1st friend joins" },
  { friends: 3, months: 2, reason: "milestone_3", label: "3 friends join" },
  { friends: 5, months: 3, reason: "milestone_5", label: "5 friends join" },
] as const;

/** Maximum free months any user can earn through referrals — the hard margin ceiling. */
export const MAX_REWARD_MONTHS: number = REFERRAL_MILESTONES.reduce((sum, m) => sum + m.months, 0);

/** Cumulative free months unlocked at a given tier index (for display). */
export function cumulativeMonthsAt(index: number): number {
  return REFERRAL_MILESTONES.slice(0, index + 1).reduce((sum, m) => sum + m.months, 0);
}

/**
 * Total free months EARNED for a given number of joined friends — the sum of incremental rewards for
 * every milestone reached. Clamps a negative/NaN input to 0; never exceeds `MAX_REWARD_MONTHS`.
 */
export function earnedRewardMonths(joined: number): number {
  const n = Number.isFinite(joined) && joined > 0 ? Math.floor(joined) : 0;
  return REFERRAL_MILESTONES.filter((m) => n >= m.friends).reduce((sum, m) => sum + m.months, 0);
}

/**
 * Which milestones a user with `joined` friends has reached — used by the DB reconciler to grant any
 * newly-earned credit rows (idempotent on `reason`). Returns the reached milestones in ladder order.
 */
export function reachedMilestones(joined: number): ReferralMilestone[] {
  const n = Number.isFinite(joined) && joined > 0 ? Math.floor(joined) : 0;
  return REFERRAL_MILESTONES.filter((m) => n >= m.friends);
}

export interface ReferralProgress {
  joined: number;
  earnedMonths: number;
  /** The next unreached milestone, or null when the ladder is maxed out. */
  next: ReferralMilestone | null;
  /** Friends still needed to reach `next` (0 when maxed out). */
  friendsToNext: number;
  /** True when every milestone has been reached. */
  maxed: boolean;
}

/** A display-ready snapshot of where a user sits on the reward ladder. */
export function referralProgress(joined: number): ReferralProgress {
  const n = Number.isFinite(joined) && joined > 0 ? Math.floor(joined) : 0;
  const next = REFERRAL_MILESTONES.find((m) => n < m.friends) ?? null;
  return {
    joined: n,
    earnedMonths: earnedRewardMonths(n),
    next,
    friendsToNext: next ? next.friends - n : 0,
    maxed: next === null,
  };
}

/** Days of bonus free trial a Premium subscription earns from referral credit (months → days, capped). */
export function referralBonusTrialDays(earnedMonths: number): number {
  const m = Number.isFinite(earnedMonths) && earnedMonths > 0 ? Math.floor(earnedMonths) : 0;
  return Math.min(m, MAX_REWARD_MONTHS) * 30;
}
