import { DismissGettingStarted } from "./getting-started-dismiss";

/**
 * First-run activation checklist (PLAN §10 growth) shown at the top of the signed-in home page —
 * a friendly, data-aware nudge that turns an empty bento into a clear path: tell us your taste,
 * add items, cook something. The caller (home page's `loadFirstRun`) computes the three booleans
 * from real data and only renders this when the user hasn't finished setup *and* hasn't dismissed
 * it, so it disappears on its own once the kitchen is in use.
 */
export type FirstRunState = {
  tasteSet: boolean;
  hasPantry: boolean;
  hasCooked: boolean;
};

type Step = {
  title: string;
  blurb: string;
  done: boolean;
  links: { href: string; label: string }[];
};

export function GettingStarted({ state }: { state: FirstRunState }) {
  const steps: Step[] = [
    {
      title: "Tell us your taste",
      blurb: "Diets, loves, hates — in a minute. Every plan and recipe gets tuned to you.",
      done: state.tasteSet,
      links: [{ href: "/onboarding", label: "Start" }],
    },
    {
      title: "Add your first items",
      blurb: "Snap your fridge, type a quick add, or connect your receipts to fill the pantry.",
      done: state.hasPantry,
      links: [
        { href: "/scan", label: "Snap your fridge" },
        { href: "/capture", label: "Quick add" },
        { href: "/pantry", label: "Connect receipts" },
      ],
    },
    {
      title: "Cook something",
      blurb: "Real meals you can make right now — tuned to your taste and what you have.",
      done: state.hasCooked,
      links: [
        { href: "/discover", label: "Discover" },
        { href: "/recipes", label: "Recipes" },
      ],
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="mx-auto max-w-6xl px-5 pt-6 sm:px-8 sm:pt-8">
      <div className="card-pad animate-fade-in-up bg-brand-50/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              <span className="dot-live" />
              Getting started
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-ink-900">
              A few steps to get the most out of GroceryManager
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="pill-brand whitespace-nowrap">{doneCount} of {steps.length}</span>
            <DismissGettingStarted />
          </div>
        </div>

        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="flex flex-col rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                {s.done ? (
                  <span
                    aria-hidden
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white shadow-brand"
                  >
                    ✓
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-sm font-bold text-brand-700"
                  >
                    {i + 1}
                  </span>
                )}
                <h3
                  className={`text-sm font-semibold ${s.done ? "text-ink-400 line-through" : "text-ink-900"}`}
                >
                  {s.title}
                </h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">{s.blurb}</p>
              {!s.done && (
                <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                  {s.links.map((l) => (
                    <a key={l.href} href={l.href} className="btn-ghost btn-sm">
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
