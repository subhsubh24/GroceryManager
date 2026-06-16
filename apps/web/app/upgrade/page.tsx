import { getDb, loadPreferenceSignals, withTenant } from "@gm/db";
import { PREMIUM_FEATURES, PREMIUM_FEATURE_INFO, isPremium } from "@gm/core/billing";
import { currentUserId } from "@/app/lib/tenant";
import { GrantPremiumPreview } from "./grant-premium-preview";

export const dynamic = "force-dynamic";

/** The whole premium surface is behind this flag (default OFF → nothing is gated anywhere). */
const billingEnabled = process.env.FEATURE_BILLING === "1";

/**
 * Resolve whether the signed-in user already has the (preview) premium entitlement. Best-effort:
 * any auth/DB hiccup just renders the page as not-yet-premium. The route is gated by middleware, so
 * `currentUserId()` is normally present.
 */
async function loadPremium(): Promise<boolean> {
  try {
    const userId = await currentUserId();
    if (!userId) return false;
    const signals = await withTenant(getDb(), userId, (tx) => loadPreferenceSignals(tx, userId));
    return isPremium(signals);
  } catch {
    return false;
  }
}

export default async function UpgradePage() {
  const premium = await loadPremium();

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/" className="text-sm text-brand-600">← Home</a>
      <h1 className="mt-2 mb-1 text-2xl font-bold tracking-tight text-ink">Go Premium</h1>
      <p className="mb-4 text-sm text-ink/60">
        Unlock the smartest parts of your kitchen autopilot — coming soon.
      </p>

      {premium && (
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
          ⭐ You&apos;re on Premium (preview)
        </p>
      )}

      {!billingEnabled && (
        <p className="mb-6 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Premium is in preview — everything is currently free.
        </p>
      )}

      <section>
        <h2 className="text-base font-semibold text-ink">What you&apos;ll get</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PREMIUM_FEATURES.map((key) => {
            const info = PREMIUM_FEATURE_INFO[key];
            return (
              <div key={key} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
                <div className="text-2xl">{info.emoji}</div>
                <h3 className="mt-3 text-base font-semibold text-ink">{info.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink/60">{info.blurb}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm">
        <div className="text-3xl font-bold text-ink">
          $0<span className="text-base font-medium text-ink/50"> / mo today</span>
        </div>
        <p className="mt-1 text-sm text-ink/60">No card required while Premium is in preview.</p>
        {/* Clearly-labeled, intentionally disabled CTA — there is NO payment flow yet. */}
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Billing isn't wired yet — connect Stripe to enable"
          className="mt-4 inline-block cursor-not-allowed rounded-xl bg-brand-500/40 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Upgrade to Premium
        </button>
        <p className="mt-2 text-xs text-ink/40">
          Billing isn&apos;t wired yet — connect Stripe to enable.
        </p>
      </section>

      {/* Preview-only: flip yourself to premium to exercise the entitlement gate (no payment). */}
      <GrantPremiumPreview premium={premium} />
    </main>
  );
}
