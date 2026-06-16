import { getDb, loadPreferenceSignals, withTenant } from "@gm/db";
import { isPremium, PREMIUM_PERKS } from "@gm/core/billing";
import { currentUserId } from "@/app/lib/tenant";
import { PageHeader } from "@/app/components/page-header";
import { PreviewButton } from "./preview-button";

export const dynamic = "force-dynamic";

export default async function UpgradePage() {
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

  return (
    <main className="page">
      <PageHeader
        accent="grape"
        emoji="⭐"
        eyebrow="Premium"
        title="Go Premium"
        subtitle="Unlock the AI planner, unlimited Discover, and recipe remix — and support the app."
      />

      {!billingOn && (
        <p className="notice-info mt-6">
          Premium is in preview — everything is currently free. Billing turns on once Stripe is
          connected.
        </p>
      )}
      {premium && (
        <p className="notice-ok mt-6">You&apos;re Premium ✓ — thanks for the support. You have full access.</p>
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
        <section className="card-pad mt-6">
          <button
            type="button"
            disabled
            title="Billing isn't wired yet — connect Stripe to enable"
            className="btn-primary cursor-not-allowed opacity-60"
          >
            Upgrade — connect Stripe to enable
          </button>
          <p className="field-hint mt-2">
            Payments aren&apos;t wired up yet (no Stripe keys). For testing the gated experience, use
            the developer preview below.
          </p>
          <div className="mt-3">
            <PreviewButton />
          </div>
        </section>
      )}
    </main>
  );
}
