import { redirect } from "next/navigation";
import { getDb, loadPreferenceSignals, withTenant } from "@gm/db";
import {
  getCurrentSubscriptionTier,
  isTrialEligible,
  SUBSCRIPTION_PLANS,
  type SubscriptionTier,
} from "@gm/core/billing";
import { currentUserId } from "@/app/lib/tenant";
import { PageHeader } from "@/app/components/page-header";
import { Star, Check, ChevronRight } from "@/app/components/icons";
import { PortalButton } from "./portal-button";

export const dynamic = "force-dynamic";

const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: "Free",
  premium_monthly: "Premium Monthly",
  premium_annual: "Premium Annual",
};

const TIER_DESCRIPTIONS: Record<SubscriptionTier, string> = {
  free: "Core pantry, cook, list, capture, and recipe features — always free.",
  premium_monthly: "Full access — AI planner, unlimited Discover, recipe remix, and more.",
  premium_annual: "Full access at the best rate — everything Premium, save ~33% vs monthly.",
};

async function load() {
  try {
    const userId = await currentUserId();
    if (!userId) return { ready: false as const };
    const signals = await withTenant(getDb(), userId, (tx) => loadPreferenceSignals(tx, userId));
    const tier = getCurrentSubscriptionTier(signals);
    const trialEligible = isTrialEligible(signals);
    return { ready: true as const, tier, trialEligible };
  } catch {
    return { ready: false as const };
  }
}

export default async function ManageSubscriptionPage() {
  const data = await load();

  if (!data.ready) {
    redirect("/signin");
  }

  const { tier, trialEligible } = data;
  const isPremium = tier !== "free";
  const billingOn = process.env.FEATURE_BILLING === "1";

  const plan = SUBSCRIPTION_PLANS.find((p) => p.tier === tier) ?? SUBSCRIPTION_PLANS[0];

  return (
    <main className="page-narrow">
      <PageHeader
        accent="grape"
        icon={Star}
        eyebrow="Billing"
        title="Your subscription"
        subtitle="Manage your plan and see what&apos;s included."
      />

      {/* Current plan card */}
      <section className="card-pad mt-6">
        <p className="field-label">Current plan</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{TIER_LABELS[tier]}</p>
        <p className="mt-1 text-sm text-ink-500">{TIER_DESCRIPTIONS[tier]}</p>

        {isPremium && (
          <ul className="mt-4 space-y-1.5">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-ink-700">
                <Check className="h-4 w-4 shrink-0 text-ok" strokeWidth={2.5} />
                {f}
              </li>
            ))}
          </ul>
        )}

        {!billingOn && (
          <p className="notice-info mt-4">
            Billing is in preview — everything is currently free. Stripe goes live once keys are
            configured.
          </p>
        )}
      </section>

      {/* Upgrade CTA (free users only) */}
      {!isPremium && (
        <section className="card-pad mt-4">
          <h2 className="section-title">Upgrade to Premium</h2>
          <p className="mt-1 text-sm text-ink-500">
            Unlock the AI planner, unlimited Discover, recipe remix, Gmail import, household
            sharing, and more.
            {trialEligible && " Start with a 7-day free trial — cancel anytime."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {SUBSCRIPTION_PLANS.filter((p) => p.tier !== "free").map((p) => (
              <div key={p.tier} className="rounded-xl border border-ink-200 bg-surface p-4">
                <p className="font-semibold">{p.label}</p>
                {p.priceMonthCents && p.tier === "premium_monthly" && (
                  <p className="mt-0.5 text-sm text-ink-500">
                    ${(p.priceMonthCents / 100).toFixed(2)}&thinsp;/ month
                  </p>
                )}
                {p.priceAnnualCents && p.tier === "premium_annual" && (
                  <p className="mt-0.5 text-sm text-ink-500">
                    ${(p.priceAnnualCents / 100).toFixed(2)}&thinsp;/ year
                    <span className="ml-1.5 text-xs text-ok">(save ~33%)</span>
                  </p>
                )}
                {p.trialDays > 0 && (
                  <p className="mt-0.5 text-xs text-ink-400">{p.trialDays}-day free trial</p>
                )}
              </div>
            ))}
          </div>

          <a href="/upgrade" className="btn-primary mt-4 flex w-full items-center justify-center gap-1.5">
            See upgrade options
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </a>
        </section>
      )}

      {/* Premium management (premium users only) */}
      {isPremium && (
        <section className="card-pad mt-4">
          <h2 className="section-title">Manage billing</h2>
          <p className="mt-1 text-sm text-ink-500">
            Update payment method, download invoices, or cancel your plan through the Stripe
            customer portal.
          </p>
          {billingOn ? (
            <div className="mt-4">
              <PortalButton />
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled
                title="Stripe customer portal — wire up STRIPE_SECRET_KEY to enable"
                className="btn-secondary mt-4 w-full cursor-not-allowed opacity-60"
              >
                Open billing portal
              </button>
              <p className="field-hint mt-2">
                The portal opens once{" "}
                <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">STRIPE_SECRET_KEY</code>{" "}
                is configured.
              </p>
            </>
          )}
        </section>
      )}

      {/* Back to profile */}
      <p className="mt-6 text-sm text-ink-400">
        <a href="/profile" className="link">
          &larr; Back to profile
        </a>
      </p>
    </main>
  );
}
