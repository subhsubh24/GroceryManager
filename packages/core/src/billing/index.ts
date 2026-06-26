/**
 * Premium / billing — SCAFFOLD ONLY (no real payments yet). The entitlement rides the existing
 * PreferenceSignal ledger (topic "entitlement", value "premium"), so there is NO schema change — a
 * real Stripe webhook would simply write that same signal. Everything is gated by a FEATURE_BILLING
 * flag (default OFF) and **fails open**: with billing disabled, `canUse` allows every feature, so the
 * scaffold never removes access from anyone. Pure + client-safe (no env, no I/O).
 */

// ---------------------------------------------------------------------------
// Subscription tiers
// ---------------------------------------------------------------------------

export type SubscriptionTier = "free" | "premium_monthly" | "premium_annual" | "premium_family";

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  label: string;
  priceMonthCents?: number;
  priceAnnualCents?: number;
  trialDays: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    tier: "free",
    label: "Free",
    trialDays: 0,
    features: [
      "Pantry tracking",
      "Receipt capture (photo)",
      "Cook & log macros",
      "Shopping list",
      "Basic recipes",
    ],
  },
  {
    tier: "premium_monthly",
    label: "Premium Monthly",
    priceMonthCents: 499,
    trialDays: 7,
    features: [
      "Everything in Free",
      "AI weekly planner",
      "Unlimited Discover feed",
      "AI recipe remix",
      "Automatic Gmail receipt import",
      "Family / household sharing",
      "Advanced spend insights",
      "Grocery Wrapped+",
    ],
  },
  {
    tier: "premium_annual",
    label: "Premium Annual",
    priceAnnualCents: 3999,
    trialDays: 7,
    features: [
      "Everything in Premium Monthly",
      "save ~33% vs monthly",
    ],
  },
  {
    tier: "premium_family",
    label: "Family",
    priceMonthCents: 999,
    priceAnnualCents: 7999,
    trialDays: 7,
    features: [
      "Everything in Premium",
      "Up to 5 household members",
      "Shared pantry & shopping list",
      "Separate profiles per member",
      "Best rate for families",
    ],
  },
];

// ---------------------------------------------------------------------------
// Feature registry
// ---------------------------------------------------------------------------

export const PREMIUM_FEATURES = [
  "plan_week",
  "discover",
  "remix",
  "gmail_import",
  "household",
  "spend_insights",
  "wrapped_plus",
] as const;

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
  {
    feature: "gmail_import",
    title: "Gmail receipt import",
    blurb: "Automatically pull receipts from your inbox — no photos needed.",
  },
  {
    feature: "household",
    title: "Household sharing",
    blurb: "Share your pantry and shopping list with your whole family.",
  },
  {
    feature: "spend_insights",
    title: "Advanced spend insights",
    blurb: "See exactly where your grocery budget goes, by category and over time.",
  },
  {
    feature: "wrapped_plus",
    title: "Grocery Wrapped+",
    blurb: "Your year in food — top items, biggest saves, and macros at a glance.",
  },
];

// ---------------------------------------------------------------------------
// Entitlement helpers (pure, client-safe)
// ---------------------------------------------------------------------------

/** True if the user holds the premium entitlement (an `entitlement=premium` preference signal). */
export function isPremium(signals: { topic: string; value: string | null }[]): boolean {
  return signals.some((s) => s.topic === "entitlement" && s.value === "premium");
}

/**
 * Derive the subscription tier from the preference-signal ledger.
 * Reads the `subscription_tier` signal written by the Stripe webhook; falls back to
 * the coarser `entitlement` signal (legacy / trial) and finally to `"free"`.
 */
export function getCurrentSubscriptionTier(
  signals: { topic: string; value: string | null }[],
): SubscriptionTier {
  const tierSignal = signals.find((s) => s.topic === "subscription_tier");
  if (tierSignal?.value === "premium_family") return "premium_family";
  if (tierSignal?.value === "premium_annual") return "premium_annual";
  if (tierSignal?.value === "premium_monthly") return "premium_monthly";
  // Fall back to the coarser `entitlement` signal (legacy / trial)
  if (isPremium(signals)) return "premium_monthly";
  return "free";
}

/**
 * True when the user has never held a paid subscription (no `subscription_renewal_at` signal),
 * meaning they are eligible for the 7-day free trial.
 */
export function isTrialEligible(signals: { topic: string; value: string | null }[]): boolean {
  return !signals.some((s) => s.topic === "subscription_renewal_at");
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
