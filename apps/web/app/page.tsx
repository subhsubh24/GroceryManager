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
    key: "recipes",
    href: "/recipes",
    title: "Cook tonight",
    blurb: "Meals you can make right now — tuned to your taste, diet, and how much energy you have.",
    emoji: "🍳",
  },
  {
    key: "list",
    href: "/list",
    title: "Shopping list",
    blurb: "Smart reorders before you run out. One tap to checkout on Instacart.",
    emoji: "🛒",
  },
  {
    key: "household",
    href: "/list",
    title: "Household & care",
    blurb: "Cleaning, skincare & toiletries on autopilot — reordered from Amazon when you're low.",
    emoji: "🧴",
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
    key: "wrapped",
    href: "/wrapped",
    title: "Grocery Wrapped",
    blurb: "Your recap: meals cooked, money saved vs takeout, top recipes — made to share.",
    emoji: "🎉",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <header className="mb-8">
        <p className="text-sm font-medium text-brand-600">GroceryManager</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">
          Never stress about groceries or cooking.
        </h1>
        <a
          href="/api/auth/signin"
          className="mt-3 inline-block rounded-xl border border-brand-200 bg-white px-3 py-1.5 text-sm font-medium text-brand-700"
        >
          Connect Gmail
        </a>
      </header>

      {/* Weekly autopilot hero */}
      <section className="mb-8 rounded-2xl bg-brand-500 p-6 text-white shadow-sm">
        <h2 className="text-lg font-semibold">This week, handled</h2>
        <p className="mt-1 text-sm text-white/90">
          Your plan + shopping list are drafted from what you have and what&apos;s running low —
          across groceries and household essentials. Review, then order in a tap.
        </p>
        <button
          className="mt-4 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition active:scale-[0.98]"
          type="button"
        >
          Plan my week
        </button>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <a
            key={s.key}
            href={s.href}
            className="group rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md"
          >
            <div className="text-2xl">{s.emoji}</div>
            <h3 className="mt-3 text-base font-semibold text-ink group-hover:text-brand-700">
              {s.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-ink/60">{s.blurb}</p>
          </a>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-ink/40">
        Phase 0 scaffold · see <code>docs/PLAN.md</code> for the full roadmap
      </p>
    </main>
  );
}
