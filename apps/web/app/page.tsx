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

export default async function HomePage() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email ?? null;
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <header className="mb-8">
        <p className="text-sm font-medium text-brand-600">GroceryManager</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">
          Never stress about groceries or cooking.
        </h1>
        {session ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm text-ink/60">Signed in{email ? ` as ${email}` : ""}</span>
            <a
              href="/profile"
              className="rounded-xl border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-ink/70"
            >
              Profile
            </a>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="rounded-xl border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-ink/70"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href="/signin"
              className="inline-block rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              Sign in
            </a>
            <a
              href="/signup"
              className="inline-block rounded-xl border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm"
            >
              Create account
            </a>
          </div>
        )}
      </header>

      {/* Weekly autopilot hero */}
      <section className="mb-8 rounded-2xl bg-brand-500 p-6 text-white shadow-sm">
        <h2 className="text-lg font-semibold">This week, handled</h2>
        <p className="mt-1 text-sm text-white/90">
          Your plan + shopping list are drafted from what you have and what&apos;s running low —
          across groceries and household essentials. Review, then order in a tap.
        </p>
        <a
          href="/plan"
          className="mt-4 inline-block rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition active:scale-[0.98]"
        >
          Plan my week
        </a>
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
        Your grocery + cooking autopilot · see <code>docs/PLAN.md</code> for the roadmap
      </p>
    </main>
  );
}
