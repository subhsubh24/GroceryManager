import { auth, signOut } from "@/auth";
import { getDb, getPantryView, loadCookedAt, loadPreferenceSignals, withTenant } from "@gm/db";
import { currentStreak } from "@gm/core/recipe";
import { currentUserId } from "@/app/lib/tenant";
import { GettingStarted, type FirstRunState } from "@/app/components/getting-started";

// Topics onboarding writes that mean "the user told us their taste". profile:* (written at signup)
// is excluded on purpose — counting it would mark step 1 done for every brand-new account.
const TASTE_KINDS = ["diet:", "allergen:", "cuisine:", "ingredient:", "quality:"];
const DISMISSED_TOPIC = "dismissed_getting_started";

type FirstRun = FirstRunState & { dismissed: boolean };
type HomeData = { streak: number; firstRun: FirstRun };

const EMPTY_FIRST_RUN: FirstRun = {
  tasteSet: false,
  hasPantry: false,
  hasCooked: false,
  dismissed: false,
};

/**
 * Signed-in home data: the cooking-streak chip + the first-run activation flags. Batches all three
 * reads into a single `withTenant` transaction (one RLS round-trip) and derives both the streak and
 * `hasCooked` from the same `cookedAt` load — no duplicate queries. Resilient: any DB/auth hiccup
 * defaults to a zero streak and an all-false (so non-blocking) first-run state. Only call for a real
 * session — the logged-out landing path stays query-free (see HomePage).
 */
async function loadHomeData(): Promise<HomeData> {
  try {
    const userId = await currentUserId();
    if (!userId) return { streak: 0, firstRun: EMPTY_FIRST_RUN };

    const { signals, pantry, cookedAt } = await withTenant(getDb(), userId, async (tx) => ({
      signals: await loadPreferenceSignals(tx, userId),
      pantry: await getPantryView(tx, userId),
      cookedAt: await loadCookedAt(tx, userId),
    }));

    return {
      streak: currentStreak(cookedAt, new Date()),
      firstRun: {
        tasteSet: signals.some((s) => TASTE_KINDS.some((k) => s.topic.startsWith(k))),
        hasPantry: pantry.length > 0,
        hasCooked: cookedAt.length > 0,
        dismissed: signals.some((s) => s.topic === DISMISSED_TOPIC),
      },
    };
  } catch {
    return { streak: 0, firstRun: EMPTY_FIRST_RUN };
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
    key: "ask",
    href: "/ask",
    title: "Ask your kitchen",
    blurb: "Chat with an AI that knows your habits — spending, cooking, what to make next.",
    emoji: "💬",
    tone: "grape",
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
    href: "/staples",
    title: "Household & personal care",
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

// ONE uniform calm card for every section, regardless of `tone` (tones are retained in the data but
// no longer drive any color). Neutral tile, clean Inter title, a quiet accent arrow on hover.
function FeatureCard({ s, index }: { s: Section; index: number }) {
  const style = { animationDelay: `${Math.min(index * 24, 280)}ms` };
  return (
    <a href={s.href} style={style} className={`group bento-card ${s.span} animate-fade-in-up`}>
      <div className="flex items-start justify-between">
        <div className="tile">{s.emoji}</div>
        {s.tag ? (
          <span className="pill-muted">{s.tag}</span>
        ) : (
          <span className="text-ink-300 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            →
          </span>
        )}
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-[-0.01em] text-ink-900">{s.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{s.blurb}</p>
    </a>
  );
}

export default async function HomePage() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email ?? null;
  // Only hit the DB for signed-in visitors; the logged-out landing path stays query-free.
  const { streak, firstRun } = session
    ? await loadHomeData()
    : { streak: 0, firstRun: null as FirstRun | null };
  // Show the activation checklist only while there's setup left and the user hasn't dismissed it.
  const showGettingStarted =
    firstRun != null &&
    !firstRun.dismissed &&
    !(firstRun.tasteSet && firstRun.hasPantry && firstRun.hasCooked);

  return (
    <main className="relative overflow-hidden">
      {/* Sticky frosted nav */}
      <header className="glass-nav sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <a href="/" className="flex items-center gap-2.5">
            <span className="tile h-9 w-9 text-lg">🧺</span>
            <span className="text-base font-semibold tracking-[-0.01em] text-ink-900">GroceryManager</span>
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

      {/* First-run activation checklist (signed-in, setup incomplete, not dismissed) */}
      {showGettingStarted && firstRun && <GettingStarted state={firstRun} />}

      {/* Signed-in users land on the APP — a lean home header + quick actions. The marketing hero,
          pitch, and autopilot band below render for LOGGED-OUT visitors only (no more pitch-on-app). */}
      {session && (
        <section className="mx-auto max-w-6xl px-5 pt-10 sm:px-8 sm:pt-12">
          <p className="eyebrow">Your kitchen</p>
          <h1 className="page-title mt-3">Welcome back</h1>
          <p className="page-subtitle">
            Jump back in — plan your week, cook what you have, or ask your kitchen anything.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href="/plan" className="btn-primary px-5 py-3 text-base">
              Plan my week →
            </a>
            <a href="/ask" className="btn-secondary px-5 py-3 text-base">
              Ask your kitchen
            </a>
            <a href="/recipes" className="btn-ghost px-5 py-3 text-base">
              Cook tonight
            </a>
          </div>
        </section>
      )}

      {!session && (
        <>
      {/* Hero — clean, spacious, type-driven. One headline, concise subtext, two CTAs. */}
      <section className="mx-auto max-w-6xl px-5 pb-14 pt-16 sm:px-8 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-fade-in-up">
            <p className="eyebrow">Your grocery + cooking autopilot</p>
            <h1 className="mt-5 text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.02em] text-ink-900 sm:text-5xl lg:text-6xl">
              Never stress about groceries or cooking again.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-500">
              It learns what you have, predicts what you&apos;re about to run out of, drafts the
              order, and serves up meals you can cook right now — groceries and household
              essentials, all on autopilot.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="/signup" className="btn-primary px-5 py-3 text-base">
                Get started — it&apos;s free
              </a>
              <a href="/recipes" className="btn-secondary px-5 py-3 text-base">
                Cook something tonight
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-brand-600">✓</span> Fills from your receipts
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-brand-600">✓</span> No bank link needed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-brand-600">✓</span> Works offline
              </span>
            </div>
          </div>

          {/* Hero visual: one calm "today" card — no glow, stickers, or shimmer. */}
          <div className="animate-fade-in [animation-delay:120ms]">
            <div className="card-pad">
              <div className="flex items-center justify-between">
                <div>
                  <div className="eyebrow">This week, handled</div>
                  <div className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink-900">
                    Your kitchen, on autopilot
                  </div>
                </div>
                <span className="pill-brand">Live</span>
              </div>
              <div className="mt-5 space-y-2.5">
                {HERO_PREVIEW.map((p) => (
                  <div
                    key={p.title}
                    className="flex items-center gap-3 rounded-xl border border-line bg-cream px-3.5 py-3"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-lg ring-1 ring-inset ring-line">
                      {p.emoji}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink-800">{p.title}</div>
                      <div className="truncate text-xs text-ink-400">{p.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-xl bg-brand-solid px-4 py-3 text-white">
                <span className="text-sm font-semibold">Ready to order — 6 items</span>
                <span aria-hidden className="text-lg">→</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Weekly autopilot — one calm solid-brand panel. */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="panel-brand sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
                Weekly autopilot
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.01em]">This week, handled.</h2>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-white/90">
                Your plan and shopping list are drafted from what you have and what&apos;s running
                low — across groceries and household essentials. Review, then order in a tap.
              </p>
            </div>
            <a
              href="/plan"
              className="btn inline-flex shrink-0 bg-white px-5 py-3 text-base text-brand-solid hover:bg-white/90"
            >
              Plan my week →
            </a>
          </div>
        </div>
      </section>
        </>
      )}

      {/* Feature grid — a launcher for signed-in users, a feature showcase for logged-out. */}
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-16 sm:px-8 sm:pt-24">
        <div className="mb-10 text-center">
          <p className="eyebrow justify-center">
            {session ? "Everything in your kitchen" : "Everything in one place"}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-ink-900 sm:text-4xl">
            {session ? "Jump into any part of the app" : "One app for the whole kitchen"}
          </h2>
          <p className="page-subtitle mx-auto text-center">
            {session
              ? "Your pantry, recipes, plan, list, spend, and more — all one tap away."
              : "From the moment a receipt lands to the meal on your plate — explore what it does for you."}
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
          <span className="tile h-9 w-9 text-lg">🧺</span>
          <p className="text-sm text-ink-400">
            Your grocery + cooking autopilot · see <code className="text-ink-500">docs/PLAN.md</code>{" "}
            for the roadmap
          </p>
        </div>
      </footer>
    </main>
  );
}
