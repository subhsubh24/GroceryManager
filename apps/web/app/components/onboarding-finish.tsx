import { finishOnboardingAction } from "@/app/onboarding/actions";

/**
 * Shown atop the seeding pages (pantry / scan / quick-add) when they're reached during onboarding
 * (?from=onboarding) — so the flow always has a clear way forward instead of dead-ending on a full
 * page. Posting calls finishOnboardingAction, which re-projects the user model and redirects to "/".
 */
export function OnboardingFinish() {
  return (
    <section className="panel-brand mt-6 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/90">Last step</p>
        <h2 className="mt-1 font-display text-lg font-semibold">All set when you are</h2>
        <p className="mt-0.5 text-sm text-white/90">
          Add what you like here — you can always add more later. Then head to your kitchen.
        </p>
      </div>
      <form action={finishOnboardingAction}>
        <button
          type="submit"
          className="btn inline-flex shrink-0 bg-white px-5 py-3 text-base text-brand-solid-hover hover:bg-white/90"
        >
          Finish setup → my kitchen
        </button>
      </form>
    </section>
  );
}
