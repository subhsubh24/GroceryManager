import { auth, signOut } from "@/auth";
import { getDb, loadCookedAt, withTenant } from "@gm/db";
import { currentStreak } from "@gm/core/recipe";
import { currentUserId } from "@/app/lib/tenant";

/** Current cooking streak for the signed-in header chip — never throws (defaults to 0). */
async function loadStreak(): Promise<number> {
  try {
    const userId = await currentUserId();
    if (!userId) return 0;
    const cookedAt = await withTenant(getDb(), userId, (tx) => loadCookedAt(tx, userId));
    return currentStreak(cookedAt, new Date());
  } catch {
    return 0;
  }
}

type Tone = "brand" | "berry" | "grape" | "ocean" | "festive" | "plain";

type Section = {
  key: string;
  href: string;
  title: string;
  blurb: string;
  emoji: string;
  tone: Tone;
  /** Layout width on the lg bento grid (out of 6 columns). */
  span: "lg:col-span-3" | "lg:col-span-2";
  tag?: string;
};

// The landing "bento": a few vivid spotlight cards lead, the rest are clean cards. Order = visual rhythm.
const SECTIONS: Section[] = [
  {
    key: "pantry",
    href: "/pantry",
    title: "A pantry that fills itself",
    blurb: "Your receipts become your inventory — automatically. It knows what you have and what's about to expire.",
    emoji: "🧺",
    tone: "brand",
    span: "lg:col-span-3",
    tag: "Flagship",
  },
  {
    key: "recipes",
    href: "/recipes",
    title: "Cook what you have tonight",
    blurb: "Real meals you can make right now — tuned to your taste, your diet, and how much energy you've actually got.",
    emoji: "🍳",
    tone: "berry",
    span: "lg:col-span-3",
    tag: "Tonight",
  },
  {
    key: "discover",
    href: "/discover",
    title: "Discover",
    blurb: "Swipe through meal ideas picked for you — it learns your taste as you go.",
    emoji: "🔥",
    tone: "berry",
    span: "lg:col-span-2",
  },
  {
    key: "cookbook",
    href: "/cookbook",
    title: "My Cookbook",
    blurb: "Save the recipes you love and cook them again in a tap.",
    emoji: "📖",
    tone: "plain",
    span: "lg:col-span-2",
  },
  {
    key: "invite",
    href: "/invite",
    title: "Invite friends",
    blurb: "Share GroceryManager — you both get a perk when they join.",
    emoji: "🎁",
    tone: "plain",
    span: "lg:col-span-2",
  },
  {
    key: "shared-household",
    href: "/household",
    title: "Shared household",
    blurb: "Share one shopping list with the people you shop for — add it once, it's there for all.",
    emoji: "🏠",
    tone: "plain",
    span: "lg:col-span-2",
  },
  {
    key: "scan",
    href: "/scan",
    title: "Scan my fridge",
    blurb: "Snap a shelf — it reconciles what's actually there against what it thinks you have.",
    emoji: "📸",
    tone: "grape",
    span: "lg:col-span-2",
  },
  {
    key: "spend",
    href: "/spend",
    title: "Spending",
    blurb: "What you spend, where it goes, and where the same item is cheaper.",
    emoji: "💸",
    tone: "ocean",
    span: "lg:col-span-2",
  },
  {
    key: "wrapped",
    href: "/wrapped",
    title: "Grocery Wrapped",
    blurb: "Your recap: meals cooked, money saved vs takeout, top recipes — made to share.",
    emoji: "🎉",
    tone: "festive",
    span: "lg:col-span-2",
  },
  {
    key: "import",
    href: "/import",
    title: "Import a recipe",
    blurb: "Paste any link or text — it's structured, matched to your pantry, and ready to cook.",
    emoji: "📥",
    tone: "plain",
    span: "lg:col-span-2",
  },
  {
    key: "list",
    href: "/list",
    title: "Shopping list",
    blurb: "Smart reorders before you run out. One tap to checkout on Instacart.",
    emoji: "🛒",
    tone: "plain",
    span: "lg:col-span-2",
  },
  {
    key: "capture",
    href: "/capture",
    title: "Quick add",
    blurb: "Type it like you'd say it — “out of milk, need taco stuff” — and it lands on your list.",
    emoji: "✍️",
    tone: "plain",
    span: "lg:col-span-2",
  },
  {
    key: "barcode",
    href: "/barcode",
    title: "Scan a barcode",
    blurb: "Scan or type a UPC — we look it up and add it to your list.",
    emoji: "📷",
    tone: "plain",
    span: "lg:col-span-2",
  },
  {
    key: "onboarding",
    href: "/onboarding",
    title: "Tell me your taste",
    blurb: "Diets, loves, hates — in a minute. Every plan and recipe gets tuned to you.",
    emoji: "👋",
    tone: "plain",
    span: "lg:col-span-2",
  },
  {
    key: "household",
    href: "/list",
    title: "Household & care",
    blurb: "Cleaning, skincare & toiletries on autopilot — reordered from Amazon when you're low.",
    emoji: "🧴",
    tone: "plain",
    span: "lg:col-span-2",
  },
  {
    key: "supplements",
    href: "/staples",
    title: "Supplements",
    blurb: "Set your daily dose — it predicts run-out (even the first bottle) and reorders in time.",
    emoji: "💊",
    tone: "plain",
    span: "lg:col-span-2",
  },
  {
    key: "staples",
    href: "/staples",
    title: "Staples autopilot",
    blurb: "Set and forget your always-on items — they appear on the list the moment they're due.",
    emoji: "🔁",
    tone: "plain",
    span: "lg:col-span-2",
  },
  {
    key: "upgrade",
    href: "/upgrade",
    title: "Go Premium",
    blurb: "Unlock the AI planner, unlimited Discover, and recipe remix — and support the app.",
    emoji: "⭐",
    tone: "plain",
    span: "lg:col-span-2",
  },
  {
    key: "use-it-up",
    href: "/use-it-up",
    title: "Use it up",
    blurb: "What's about to spoil, with one-tap recipes to rescue it before it's wasted.",
    emoji: "♻️",
    tone: "plain",
    span: "lg:col-span-2",
  },
  {
    key: "digest",
    href: "/digest",
    title: "This week",
    blurb: "Your Sunday briefing — what's expiring, what's due to reorder, at a glance.",
    emoji: "🗒️",
    tone: "plain",
    span: "lg:col-span-2",
  },
];

// A few signature flows surfaced as a "menu" inside the hero visual.
const HERO_PREVIEW: { emoji: string; title: string; meta: string }[] = [
  { emoji: "🍳", title: "Tonight: Lemon herb chicken", meta: "have 7/8 · uses spinach" },
  { emoji: "🛒", title: "Reorder ready", meta: "6 staples due · 1 tap to cart" },
  { emoji: "♻️", title: "Use it up", meta: "2 items expiring soon" },
];

const SPOT_CLASS: Record<Exclude<Tone, "plain" | "festive">, string> = {
  brand: "spot-brand",
  berry: "spot-berry",
  grape: "spot-grape",
  ocean: "spot-ocean",
};

function FeatureCard({ s, index }: { s: Section; index: number }) {
  const style = { animationDelay: `${Math.min(index * 55, 600)}ms` };

  // Vivid full-bleed spotlight card (white text).
  if (s.tone !== "plain" && s.tone !== "festive") {
    const big = s.span === "lg:col-span-3";
    return (
      <a
        href={s.href}
        style={style}
        className={`group bento-spot ${SPOT_CLASS[s.tone]} ${s.span} animate-fade-in-up`}
      >
        <div className="flex items-start justify-between">
          <div className="tile-on-color">{s.emoji}</div>
          {s.tag ? (
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/25">
              {s.tag}
            </span>
          ) : (
            <span className="translate-x-1 text-white/0 transition duration-300 ease-spring group-hover:translate-x-0 group-hover:text-white">
              →
            </span>
          )}
        </div>
        <h3 className={`mt-5 font-display font-semibold tracking-tight ${big ? "text-2xl" : "text-xl"}`}>
          {s.title}
        </h3>
        <p className={`mt-2 leading-relaxed text-white/85 ${big ? "text-[0.95rem] max-w-md" : "text-sm"}`}>
          {s.blurb}
        </p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-white/90 transition group-hover:gap-2">
          Open <span aria-hidden>→</span>
        </span>
      </a>
    );
  }

  // Festive (Wrapped): light card with a colorful tile + soft glow.
  if (s.tone === "festive") {
    return (
      <a href={s.href} style={style} className={`group bento-card ${s.span} animate-fade-in-up`}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sunset-gradient opacity-25 blur-2xl transition duration-500 group-hover:opacity-40" />
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sunset-gradient text-xl text-white shadow-sm transition duration-300 ease-spring group-hover:-rotate-3 group-hover:scale-105">
            {s.emoji}
          </div>
          <span className="translate-x-1 text-ink-200 opacity-0 transition duration-300 ease-spring group-hover:translate-x-0 group-hover:text-berry-500 group-hover:opacity-100">
            →
          </span>
        </div>
        <h3 className="mt-4 text-base font-semibold text-ink-900 transition-colors group-hover:text-berry-600">
          {s.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{s.blurb}</p>
      </a>
    );
  }

  // Plain bento card.
  return (
    <a href={s.href} style={style} className={`group bento-card ${s.span} animate-fade-in-up`}>
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
  );
}

export default async function HomePage() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email ?? null;
  // Only hit the DB for signed-in visitors; the logged-out landing path stays query-free.
  const streak = session ? await loadStreak() : 0;

  return (
    <main className="relative overflow-hidden">
      {/* Sticky frosted nav */}
      <header className="glass-nav sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <a href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-lg shadow-brand">
              🧺
            </span>
            <span className="text-base font-semibold tracking-tight text-ink-900">GroceryManager</span>
          </a>
          {session ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {streak > 0 && (
                <a href="/digest" className="pill-brand hidden sm:inline-flex" title="Your cooking streak">
                  🔥 {streak}-day streak
                </a>
              )}
              <span className="hidden text-sm text-ink-400 sm:inline">{email ? email : "Signed in"}</span>
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
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-8 sm:pt-20">
        {/* Living aurora backdrop */}
        <div className="aurora-stage">
          <div className="aurora-blob -left-16 -top-12 h-72 w-72 bg-brand-400/45" />
          <div className="aurora-blob -right-12 top-8 h-80 w-80 bg-citrus-300/45 [animation-delay:-6s]" />
          <div className="aurora-blob left-1/3 top-64 h-72 w-72 bg-ocean-300/35 [animation-delay:-12s]" />
          <div className="aurora-blob right-1/4 top-72 h-64 w-64 bg-berry-300/30 [animation-delay:-9s]" />
        </div>

        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-fade-in-up">
            <p className="eyebrow">
              <span className="dot-live" />
              Your grocery + cooking autopilot
            </p>
            <h1 className="mt-5 font-display text-[2.7rem] font-semibold leading-[1.02] tracking-tight text-ink-900 sm:text-display lg:text-display-lg">
              Never stress about{" "}
              <span className="text-gradient-brand">groceries or cooking</span> again.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-500">
              It learns what you have, predicts what you&apos;re about to run out of, drafts the
              order, and serves up meals you can cook right now — groceries and household
              essentials, all on autopilot.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={session ? "/plan" : "/signup"}
                className="btn-primary shine relative overflow-hidden px-5 py-3 text-base"
              >
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

          {/* Hero visual: a tasteful "today" card floating on a soft gradient, with sticker accents. */}
          <div className="relative animate-fade-in [animation-delay:140ms]">
            <div className="absolute -inset-6 -z-10 rounded-[2.75rem] bg-brand-gradient opacity-20 blur-2xl" />
            {/* Floating sticker accents */}
            <div className="absolute -left-5 top-10 hidden animate-float rounded-2xl bg-surface px-3 py-2 text-2xl shadow-lift sm:block [animation-delay:-2s]">
              🥑
            </div>
            <div className="absolute -right-4 bottom-16 hidden animate-float rounded-2xl bg-surface px-3 py-2 text-2xl shadow-lift sm:block [animation-delay:-4s]">
              🍅
            </div>
            <div className="card-pad rounded-3xl shadow-lift-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                    This week, handled
                  </div>
                  <div className="mt-1 font-display text-xl font-semibold text-ink-900">
                    Your kitchen, on autopilot
                  </div>
                </div>
                <span className="pill-brand inline-flex items-center gap-1.5">
                  <span className="dot-live" /> Live
                </span>
              </div>
              <div className="mt-5 space-y-2.5">
                {HERO_PREVIEW.map((p, i) => (
                  <div
                    key={p.title}
                    style={{ animationDelay: `${260 + i * 90}ms` }}
                    className="flex animate-fade-in-up items-center gap-3 rounded-2xl border border-line bg-cream/60 px-3.5 py-3"
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
              <div className="shine relative mt-5 flex items-center justify-between overflow-hidden rounded-2xl bg-brand-gradient px-4 py-3 text-white shadow-brand">
                <span className="text-sm font-semibold">Ready to order — 6 items</span>
                <span className="text-lg">→</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Weekly autopilot CTA band */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="panel-brand shine sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
                <span className="dot-live bg-white" /> Weekly autopilot
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold">This week, handled.</h2>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-white/90">
                Your plan and shopping list are drafted from what you have and what&apos;s running
                low — across groceries and household essentials. Review, then order in a tap.
              </p>
            </div>
            <a
              href="/plan"
              className="btn inline-flex shrink-0 bg-white px-5 py-3 text-base text-[#0a6e33] shadow-lift hover:bg-white/95"
            >
              Plan my week →
            </a>
          </div>
        </div>
      </section>

      {/* Feature bento */}
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-14 sm:px-8 sm:pt-20">
        <div className="mb-8 text-center">
          <p className="eyebrow justify-center">Everything in one place</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
            One app for the whole kitchen
          </h2>
          <p className="page-subtitle mx-auto text-center">
            From the moment a receipt lands to the meal on your plate — explore what it does for you.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {SECTIONS.map((s, i) => (
            <FeatureCard key={s.key} s={s} index={i} />
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
