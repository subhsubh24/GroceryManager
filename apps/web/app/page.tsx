import { auth, signOut } from "@/auth";

type Section = {
  key: string;
  href: string;
  title: string;
  blurb: string;
  emoji: string;
};

const SECTIONS: Section[] = [
  {
    key: "pantry",
    href: "/pantry",
    title: "Pantry",
    blurb: "Fills itself from your receipts. Knows what you have and what's about to expire.",
    emoji: "🧺",
  },
  {
    key: "scan",
    href: "/scan",
    title: "Scan my fridge",
    blurb: "Snap a shelf — it reconciles what's actually there against what it thinks you have.",
    emoji: "📸",
  },
  {
    key: "recipes",
    href: "/recipes",
    title: "Cook tonight",
    blurb: "Meals you can make right now — tuned to your taste, diet, and how much energy you have.",
    emoji: "🍳",
  },
  {
    key: "import",
    href: "/import",
    title: "Import a recipe",
    blurb: "Paste any recipe link or text — it's structured, matched to your pantry, and ready to cook.",
    emoji: "📥",
  },
  {
    key: "list",
    href: "/list",
    title: "Shopping list",
    blurb: "Smart reorders before you run out. One tap to checkout on Instacart.",
    emoji: "🛒",
  },
  {
    key: "capture",
    href: "/capture",
    title: "Quick add",
    blurb: "Type it like you'd say it — “out of milk, need taco stuff” — and it lands on your list.",
    emoji: "✍️",
  },
  {
    key: "onboarding",
    href: "/onboarding",
    title: "Tell me your taste",
    blurb: "Diets, loves, hates — in a minute. Every plan and recipe gets tuned to you.",
    emoji: "👋",
  },
  {
    key: "household",
    href: "/list",
    title: "Household & care",
    blurb: "Cleaning, skincare & toiletries on autopilot — reordered from Amazon when you're low.",
    emoji: "🧴",
  },
  {
    key: "supplements",
    href: "/staples",
    title: "Supplements",
    blurb: "Set your daily dose — it predicts run-out (even the first bottle) and reorders from Amazon in time.",
    emoji: "💊",
  },
  {
    key: "staples",
    href: "/staples",
    title: "Staples autopilot",
    blurb: "Set and forget your always-on items — they appear on the list the moment they're due.",
    emoji: "🔁",
  },
  {
    key: "use-it-up",
    href: "/use-it-up",
    title: "Use it up",
    blurb: "What's about to spoil, with one-tap recipes to rescue it before it's wasted.",
    emoji: "♻️",
  },
  {
    key: "spend",
    href: "/spend",
    title: "Spending",
    blurb: "What you spend, where it goes, and where the same item is cheaper.",
    emoji: "💸",
  },
  {
    key: "digest",
    href: "/digest",
    title: "This week",
    blurb: "Your Sunday briefing — what's expiring, what's due to reorder, at a glance.",
    emoji: "🗒️",
  },
  {
    key: "wrapped",
    href: "/wrapped",
    title: "Grocery Wrapped",
    blurb: "Your recap: meals cooked, money saved vs takeout, top recipes — made to share.",
    emoji: "🎉",
  },
];

// A few signature flows surfaced as a "menu" inside the hero visual.
const HERO_PREVIEW: { emoji: string; title: string; meta: string }[] = [
  { emoji: "🍳", title: "Tonight: Lemon herb chicken", meta: "have 7/8 · uses spinach" },
  { emoji: "🛒", title: "Reorder ready", meta: "6 staples due · 1 tap to cart" },
  { emoji: "♻️", title: "Use it up", meta: "2 items expiring soon" },
];

export default async function HomePage() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email ?? null;

  return (
    <main className="relative overflow-hidden">
      {/* Top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 pt-6 sm:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-lg shadow-brand">
            🧺
          </span>
          <span className="text-base font-semibold tracking-tight text-ink-900">GroceryManager</span>
        </div>
        {session ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-ink-400 sm:inline">
              {email ? email : "Signed in"}
            </span>
            <a href="/profile" className="btn-ghost btn-sm">
              Profile
            </a>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className="btn-ghost btn-sm">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/signin" className="btn-ghost btn-sm">
              Sign in
            </a>
            <a href="/signup" className="btn-primary btn-sm">
              Get started
            </a>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-10 pt-10 sm:px-8 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-fade-in-up">
            <p className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Your grocery + cooking autopilot
            </p>
            <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-ink-900 sm:text-display lg:text-display-lg">
              Never stress about{" "}
              <span className="bg-gradient-to-br from-brand-500 to-brand-700 bg-clip-text text-transparent">
                groceries or cooking
              </span>{" "}
              again.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-500">
              It learns what you have, predicts what you&apos;re about to run out of, drafts the
              order, and suggests meals you can cook right now — across groceries and household
              essentials.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={session ? "/plan" : "/signup"} className="btn-primary px-5 py-3 text-base">
                {session ? "Plan my week" : "Get started — it's free"}
              </a>
              <a href="/recipes" className="btn-ghost px-5 py-3 text-base">
                Cook something tonight
              </a>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-brand-500">✓</span> Fills from your receipts
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-brand-500">✓</span> No bank link needed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-brand-500">✓</span> Works offline
              </span>
            </div>
          </div>

          {/* Hero visual: a tasteful "today" card floating on a soft gradient. */}
          <div className="relative animate-fade-in [animation-delay:120ms]">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-brand-gradient opacity-15 blur-2xl" />
            <div className="card-pad rounded-3xl shadow-lift">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                    This week, handled
                  </div>
                  <div className="mt-1 font-display text-xl font-semibold text-ink-900">
                    Your kitchen, on autopilot
                  </div>
                </div>
                <span className="pill-brand">Live</span>
              </div>
              <div className="mt-5 space-y-2.5">
                {HERO_PREVIEW.map((p) => (
                  <div
                    key={p.title}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-cream/60 px-3.5 py-3"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-lg shadow-xs">
                      {p.emoji}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink-800">{p.title}</div>
                      <div className="truncate text-xs text-ink-400">{p.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-2xl bg-brand-gradient px-4 py-3 text-white shadow-brand">
                <span className="text-sm font-semibold">Ready to order — 6 items</span>
                <span className="text-lg">→</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Weekly autopilot CTA band */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="panel-brand sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-semibold">This week, handled.</h2>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-white/90">
                Your plan and shopping list are drafted from what you have and what&apos;s running
                low — across groceries and household essentials. Review, then order in a tap.
              </p>
            </div>
            <a
              href="/plan"
              className="btn inline-flex shrink-0 bg-white px-5 py-3 text-base text-brand-700 shadow-lift hover:bg-white/95"
            >
              Plan my week →
            </a>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-14 sm:px-8 sm:pt-20">
        <div className="mb-8 text-center">
          <p className="eyebrow justify-center">Everything in one place</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-900">
            One app for the whole kitchen
          </h2>
          <p className="page-subtitle mx-auto text-center">
            From the moment a receipt lands to the meal on your plate — explore what it does for you.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <a key={s.key} href={s.href} className="group card-link">
              <div className="flex items-start justify-between">
                <div className="tile">{s.emoji}</div>
                <span className="translate-x-1 text-ink-200 opacity-0 transition duration-300 ease-spring group-hover:translate-x-0 group-hover:text-brand-500 group-hover:opacity-100">
                  →
                </span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink-900 transition-colors group-hover:text-brand-700">
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{s.blurb}</p>
            </a>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 pb-14 pt-6 sm:px-8">
        <div className="flex flex-col items-center gap-2 border-t border-line pt-8 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-lg ring-1 ring-inset ring-brand-100">
            🧺
          </span>
          <p className="text-sm text-ink-400">
            Your grocery + cooking autopilot · see <code className="text-ink-500">docs/PLAN.md</code>{" "}
            for the roadmap
          </p>
        </div>
      </footer>
    </main>
  );
}
