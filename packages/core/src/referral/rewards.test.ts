import { describe, expect, it } from "vitest";
import {
  MAX_REWARD_MONTHS,
  REFERRAL_MILESTONES,
  cumulativeMonthsAt,
  earnedRewardMonths,
  reachedMilestones,
  referralBonusTrialDays,
  referralProgress,
} from "./rewards.js";

describe("referral reward ladder", () => {
  it("milestones are in ascending friend order with stable, unique reasons", () => {
    const friends = REFERRAL_MILESTONES.map((m) => m.friends);
    const sorted = [...friends].sort((a, b) => a - b);
    expect(friends).toEqual(sorted);
    expect(new Set(friends).size).toBe(friends.length);
    const reasons = REFERRAL_MILESTONES.map((m) => m.reason);
    expect(new Set(reasons).size).toBe(reasons.length);
    for (const m of REFERRAL_MILESTONES) expect(m.months).toBeGreaterThan(0);
  });

  it("MAX_REWARD_MONTHS is the sum of all incremental rewards (6)", () => {
    expect(MAX_REWARD_MONTHS).toBe(6);
  });

  it("cumulativeMonthsAt sums incremental rewards through the index", () => {
    expect(cumulativeMonthsAt(0)).toBe(1);
    expect(cumulativeMonthsAt(1)).toBe(3);
    expect(cumulativeMonthsAt(2)).toBe(6);
  });
});

describe("earnedRewardMonths", () => {
  it("is 0 before any friend joins", () => {
    expect(earnedRewardMonths(0)).toBe(0);
  });

  it("steps up only at each milestone (1→1, 3→3, 5→6) and holds between", () => {
    expect(earnedRewardMonths(1)).toBe(1);
    expect(earnedRewardMonths(2)).toBe(1);
    expect(earnedRewardMonths(3)).toBe(3);
    expect(earnedRewardMonths(4)).toBe(3);
    expect(earnedRewardMonths(5)).toBe(6);
  });

  it("caps at MAX_REWARD_MONTHS no matter how many join", () => {
    expect(earnedRewardMonths(50)).toBe(MAX_REWARD_MONTHS);
    expect(earnedRewardMonths(5)).toBe(MAX_REWARD_MONTHS);
  });

  it("clamps invalid/negative/fractional input", () => {
    expect(earnedRewardMonths(-3)).toBe(0);
    expect(earnedRewardMonths(Number.NaN)).toBe(0);
    expect(earnedRewardMonths(2.9)).toBe(1);
  });
});

describe("reachedMilestones", () => {
  it("returns exactly the reached tiers", () => {
    expect(reachedMilestones(0)).toHaveLength(0);
    expect(reachedMilestones(1).map((m) => m.reason)).toEqual(["milestone_1"]);
    expect(reachedMilestones(4).map((m) => m.reason)).toEqual(["milestone_1", "milestone_3"]);
    expect(reachedMilestones(99)).toHaveLength(REFERRAL_MILESTONES.length);
  });
});

describe("referralProgress", () => {
  it("reports the next milestone and friends remaining", () => {
    const p0 = referralProgress(0);
    expect(p0.earnedMonths).toBe(0);
    expect(p0.next?.friends).toBe(1);
    expect(p0.friendsToNext).toBe(1);
    expect(p0.maxed).toBe(false);

    const p2 = referralProgress(2);
    expect(p2.next?.friends).toBe(3);
    expect(p2.friendsToNext).toBe(1);
  });

  it("is maxed out once the ladder is complete", () => {
    const p = referralProgress(5);
    expect(p.maxed).toBe(true);
    expect(p.next).toBeNull();
    expect(p.friendsToNext).toBe(0);
    expect(p.earnedMonths).toBe(MAX_REWARD_MONTHS);
  });
});

describe("referralBonusTrialDays", () => {
  it("converts earned months to days (30/mo) and caps at the ceiling", () => {
    expect(referralBonusTrialDays(0)).toBe(0);
    expect(referralBonusTrialDays(1)).toBe(30);
    expect(referralBonusTrialDays(6)).toBe(180);
    expect(referralBonusTrialDays(999)).toBe(MAX_REWARD_MONTHS * 30);
  });

  it("clamps invalid input to 0", () => {
    expect(referralBonusTrialDays(-1)).toBe(0);
    expect(referralBonusTrialDays(Number.NaN)).toBe(0);
  });
});
