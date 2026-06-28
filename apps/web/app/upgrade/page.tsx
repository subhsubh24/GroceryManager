import { getDb, loadPreferenceSignals, withTenant } from "@gm/db";
import { isPremium, PREMIUM_PERKS } from "@gm/core/billing";
import { currentUserId } from "@/app/lib/tenant";
import { PageHeader } from "@/app/components/page-header";
import { Check, Star } from "@/app/components/icons";
import { PreviewButton } from "./preview-button";
import { CheckoutButton } from "./checkout-button";
import { PlausiblePageview } from "@/app/components/PlausiblePageview";

export const dynamic = "force-dynamic";

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  // FEATURE_BILLING is an optional flag (default off). Off → premium is "in preview" and free.
  const billingOn = process.env.FEATURE_BILLING === "1";

  let premium = false;
  try {
    const userId = await currentUserId();
    if (userId) {
      const signals = await withTenant(getDb(), userId, (tx) => loadPreferenceSignals(tx, userId));
      premium = isPremium(signals);
    }
  } catch {
    premium = false;
  }

  const params = await searchParams;
  const success = params.success === "1";
  const canceled = params.canceled === "1";

  return (
    <main className="page">
      {/* Track upgrade page views for conversion funnel analytics. */}
      <PlausiblePageview event="upgrade_view" />
      <PageHeader
        accent="grape"
        icon={Star}
        eyebrow="Premium"
        title="Go Premium"
        subtitle="Unlock the AI planner, unlimited Discover, and recipe remix — and support the app."
      />

      {success && (
        <p className="notice-ok mt-6 flex items-center gap-1.5">
          <Check className="h-4 w-4 shrink-0" strokeWidth={2} /> Welcome to Premium! Your
          subscription is active — full access is unlocked.
        </p>
      )}
      {canceled && !success && (
        <p className="notice-info mt-6">
          Checkout canceled — no charge was made. You can upgrade whenever you&apos;re ready.
        </p>
      )}

      {!billingOn && !success && (
        <p className="notice-info mt-6">
          Premium is in preview — everything is currently free. Billing turns on once Stripe is
          connected.
        </p>
      )}
      {premium && !success && (
        <p className="notice-ok mt-6 flex items-center gap-1.5">
          <Check className="h-4 w-4 shrink-0" strokeWidth={2} /> You&apos;re Premium — thanks for the
          support. You have full access.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {PREMIUM_PERKS.map((p) => (
          <div key={p.feature} className="card-pad">
            <h2 className="section-title">{p.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{p.blurb}</p>
          </div>
        ))}
      </div>

      {!premium && (
        <section className="mt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Monthly card */}
            <div className="card-pad">
              <p className="font-semibold">Premium Monthly</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                $4.99
                <span className="text-sm font-normal text-ink-500"> / month</span>
              </p>
              <p className="mt-0.5 text-sm text-ink-400">7-day free trial</p>
              {billingOn ? (
                <div className="mt-4">
                  <CheckoutButton plan="monthly" label="Start free trial" />
                </div>
              ) : (
                <button
                  disabled
                  className="btn-primary mt-4 w-full cursor-not-allowed opacity-60"
                >
                  Coming soon
                </button>
              )}
            </div>
            {/* Annual card */}
            <div className="card-pad">
              <div className="flex items-start justify-between">
                <p className="font-semibold">Premium Annual</p>
                <span className="pill-success">
                  Save ~33%
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                $39.99
                <span className="text-sm font-normal text-ink-500"> / year</span>
              </p>
              <p className="mt-0.5 text-sm text-ink-400">7-day free trial</p>
              {billingOn ? (
                <div className="mt-4">
                  <CheckoutButton plan="annual" label="Start free trial" />
                </div>
              ) : (
                <button
                  disabled
                  className="btn-primary mt-4 w-full cursor-not-allowed opacity-60"
                >
                  Coming soon
                </button>
              )}
            </div>
            {/* Family card */}
            <div className="card-pad">
              <div className="flex items-start justify-between">
                <p className="font-semibold">Family Plan</p>
                <span className="pill-success">
                  Best for families
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                $9.99
                <span className="text-sm font-normal text-ink-500"> / month</span>
              </p>
              <p className="mt-0.5 text-sm text-ink-400">or $79.99/yr · 7-day free trial · up to 5 members</p>
              {billingOn ? (
                <div className="mt-4">
                  <CheckoutButton plan="family" label="Start free trial" />
                </div>
              ) : (
                <button
                  disabled
                  className="btn-primary mt-4 w-full cursor-not-allowed opacity-60"
                >
                  Coming soon
                </button>
              )}
            </div>
          </div>
          {!billingOn && (
            <div className="mt-4">
              <p className="field-hint">For testing the premium experience:</p>
              <PreviewButton />
            </div>
          )}
        </section>
      )}
    </main>
  );
}
