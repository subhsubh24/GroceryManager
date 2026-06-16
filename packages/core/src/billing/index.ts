/**
 * Premium / billing entitlements (larger-platform scaffold) — pure, testable gating helpers.
 *
 * There is NO payment provider wired in this repo: this module only answers "is this user
 * premium?" and "may this feature be used?" so a real Stripe integration can later plug in
 * behind it. Entitlement is NOT a schema change — it rides the append-only PreferenceSignal
 * ledger as an `entitlement` signal whose `value` is `"premium"` (mirroring how other growth
 * features reuse the ledger). The web app reads it with the same `loadPreferenceSignals` shape.
 *
 * Flag convention: the whole feature is behind `FEATURE_BILLING` (default OFF). When OFF, nothing
 * is ever gated — `canUse` returns true for everything, so existing behavior is unchanged. This
 * module stays pure (no `process.env`, no I/O): callers pass the flag in, so it's trivial to test.
 */

/** Topic of the entitlement signal on the preference ledger (the real Stripe webhook would write this). */
export const ENTITLEMENT_TOPIC = "entitlement";
/** The `value` an `entitlement` signal carries to mark a user as premium. */
export const PREMIUM_VALUE = "premium";

/**
 * Feature keys that *would* be premium once billing is wired. Descriptive only — used to render the
 * upgrade page's perk list and to decide what `canUse` gates when the flag is on. Keep this small and
 * aligned with real route/feature names so a later Stripe integration can map cleanly.
 */
export const PREMIUM_FEATURES = ["plan_week", "discover", "remix"] as const;

export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

/** Human-friendly copy for each premium feature key (drives the /upgrade marketing cards). */
export const PREMIUM_FEATURE_INFO: Record<
  PremiumFeature,
  { title: string; blurb: string; emoji: string }
> = {
  plan_week: {
    title: "Plan my week",
    blurb: "Auto-draft a full week of meals from what you have and what's running low.",
    emoji: "🗓️",
  },
  discover: {
    title: "Unlimited Discover",
    blurb: "Swipe through endless meal ideas tuned to your taste — no daily cap.",
    emoji: "🔥",
  },
  remix: {
    title: "Recipe Remix",
    blurb: "Reinvent any recipe around your pantry, diet, and the time you've got.",
    emoji: "✨",
  },
};

/**
 * Whether the loaded preference signals mark this user as premium. Pure: true iff an `entitlement`
 * signal with value `"premium"` exists. Accepts the exact `{ topic, value }` shape that
 * `loadPreferenceSignals` returns (extra fields ignored), so callers can pass it straight through.
 */
export function isPremium(signals: { topic: string; value: string | null }[]): boolean {
  return signals.some((s) => s.topic === ENTITLEMENT_TOPIC && s.value === PREMIUM_VALUE);
}

/**
 * Whether `feature` may be used. The gate is intentionally fail-open:
 *   • If `billingEnabled` is false (the `FEATURE_BILLING` flag is OFF) → ALWAYS true. Nothing is
 *     gated; existing behavior is unchanged. This is the default everywhere today.
 *   • Otherwise → allowed if the user is `premium`, OR the feature isn't in `PREMIUM_FEATURES`
 *     (non-premium features stay free for everyone).
 */
export function canUse(feature: string, premium: boolean, billingEnabled: boolean): boolean {
  if (!billingEnabled) return true; // flag off → nothing gated
  return premium || !(PREMIUM_FEATURES as readonly string[]).includes(feature);
}
