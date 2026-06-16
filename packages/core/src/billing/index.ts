/**
 * Premium / billing — SCAFFOLD ONLY (no real payments yet). The entitlement rides the existing
 * PreferenceSignal ledger (topic "entitlement", value "premium"), so there is NO schema change — a
 * real Stripe webhook would simply write that same signal. Everything is gated by a FEATURE_BILLING
 * flag (default OFF) and **fails open**: with billing disabled, `canUse` allows every feature, so the
 * scaffold never removes access from anyone. Pure + client-safe (no env, no I/O).
 */
export const PREMIUM_FEATURES = ["plan_week", "discover", "remix"] as const;
export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

export const PREMIUM_PERKS: { feature: PremiumFeature; title: string; blurb: string }[] = [
  {
    feature: "plan_week",
    title: "AI weekly planner",
    blurb: "Let the agent plan your whole week around what you have and what's about to expire.",
  },
  {
    feature: "discover",
    title: "Unlimited Discover",
    blurb: "Swipe endlessly through meal ideas tuned to your taste.",
  },
  {
    feature: "remix",
    title: "AI recipe remix",
    blurb: "Make any recipe healthier, cheaper, faster, or vegan in a tap.",
  },
];

/** True if the user holds the premium entitlement (an `entitlement=premium` preference signal). */
export function isPremium(signals: { topic: string; value: string | null }[]): boolean {
  return signals.some((s) => s.topic === "entitlement" && s.value === "premium");
}

/**
 * Whether a feature is usable. **Fails open**: when billing is disabled (flag off) everything is
 * allowed, so this scaffold never removes access. When enabled, premium features require the
 * entitlement; non-premium features are always allowed.
 */
export function canUse(feature: string, premium: boolean, billingEnabled: boolean): boolean {
  if (!billingEnabled) return true;
  if (!(PREMIUM_FEATURES as readonly string[]).includes(feature)) return true;
  return premium;
}
