import {
  countReferralsJoined,
  getDb,
  grantReferralCredits,
  sumReferralCreditMonths,
  withTenant,
} from "@gm/db";
import { reachedMilestones } from "@gm/core/referral/rewards";

export interface ReferralReward {
  /** Friends who have joined via this user's link. */
  joined: number;
  /** Free months earned and persisted in the referral_credits ledger. */
  earnedMonths: number;
}

/**
 * Reconcile a user's referral milestones into the durable `referral_credits` ledger and return their
 * current standing. Idempotent: counts joined friends, grants any newly-reached milestone (no-op if
 * already granted), then sums the ledger as the source of truth. Tenant-scoped (RLS WITH CHECK). The
 * `@gm/core` milestone ladder is resolved HERE — `@gm/db` must not import `@gm/core` (cycle).
 *
 * Resilient: returns a zeroed reward on any failure so a render path never breaks on referral state.
 */
export async function reconcileReferralRewards(userId: string): Promise<ReferralReward> {
  try {
    return await withTenant(getDb(), userId, async (tx) => {
      const joined = await countReferralsJoined(tx, userId);
      const reached = reachedMilestones(joined);
      await grantReferralCredits(
        tx,
        userId,
        reached.map((m) => ({ months: m.months, reason: m.reason })),
      );
      const earnedMonths = await sumReferralCreditMonths(tx, userId);
      return { joined, earnedMonths };
    });
  } catch {
    return { joined: 0, earnedMonths: 0 };
  }
}
