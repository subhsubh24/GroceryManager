import { auth, signOut } from "@/auth";
import {
  getActiveListView,
  getDb,
  getPantryView,
  loadCookedAt,
  loadPreferenceSignals,
  withTenant,
} from "@gm/db";
import { currentStreak } from "@gm/core/recipe";
import { selectExpiringSoon } from "@gm/core/pantry";
import { currentUserId } from "@/app/lib/tenant";
import { GettingStarted, type FirstRunState } from "@/app/components/getting-started";
import { FeatureCard } from "@/app/components/feature-card";
import { SECTIONS, type Section } from "@/app/lib/sections";

// Topics onboarding writes that mean "the user told us their taste". profile:* (written at signup)
// is excluded on purpose — counting it would mark step 1 done for every brand-new account.
const TASTE_KINDS = ["diet:", "allergen:", "cuisine:", "ingredient:", "quality:"];
const DISMISSED_TOPIC = "dismissed_getting_started";

type FirstRun = FirstRunState & { dismissed: boolean };
/** Live, real-data status counts for the focused dashboard cards. */
type HomeStats = { streak: number; expiringCount: number; listCount: number };
type HomeData = HomeStats & { firstRun: FirstRun };

const EMPTY_FIRST_RUN: FirstRun = {
  tasteSet: false,
  hasPantry: false,
  hasCooked: false,
  dismissed: false,
};

const EMPTY_HOME_DATA: HomeData = {
  streak: 0,
  expiringCount: 0,
  listCount: 0,
  firstRun: EMPTY_FIRST_RUN,
};

/**
 * Signed-in home data for the focused dashboard: the cooking-streak chip, the first-run activation
 * flags, and the live status counts (items to use up + items on the active list). Batches every read
 * into a single `withTenant` transaction (one RLS round-trip) and derives the streak and `hasCooked`
 * from the same `cookedAt` load — no duplicate queries. Counts are REAL (computed from pantry/list
 * rows), never placeholders. Resilient: any DB/auth hiccup defaults to zero counts and an all-false
 * (so non-blocking) first-run state. Only call for a real session — the logged-out landing path
 * stays query-free (see HomePage).
 */
async function loadHomeData(): Promise<HomeData> {
  try {
    const userId = await currentUserId();
    if (!userId) return EMPTY_HOME_DATA;

    const { signals, pantry, cookedAt, list } = await withTenant(getDb(), userId, async (tx) => ({
      signals: await loadPreferenceSignals(tx, userId),
      pantry: await getPantryView(tx, userId),
      cookedAt: await loadCookedAt(tx, userId),
      list: await getActiveListView(tx, userId),
    }));

    const now = new Date();
    return {
      streak: currentStreak(cookedAt, now),
      // Grocery items past their shelf-life ceiling or about to run out — the "use it up" set.
      expiringCount: selectExpiringSoon(pantry, { domain: "grocery", withinDays: 5, now }).length,
      // Unchecked items on the active shopping list.
      listCount: list.filter((i) => !i.checked).length,
      firstRun: {
        tasteSet: signals.some((s) => TASTE_KINDS.some((k) => s.topic.startsWith(k))),
        hasPantry: pantry.length > 0,
        hasCooked: cookedAt.length > 0,
        dismissed: signals.some((s) => s.topic === DISMISSED_TOPIC),
      },
    };
  } catch {
    return EMPTY_HOME_DATA;
  }
}

// Logged-out highlights: a short flagship set (not the full ~20). Picked from the shared catalog by
// key so titles/blurbs/emoji can't drift from /tools. Conversion-focused, calm.
const HIGHLIGHT_KEYS = ["pantry", "recipes", "plan", "discover", "spend", "wrapped"];
const HIGHLIGHTS: Section[] = HIGHLIGHT_KEYS.map((k) => SECTIONS.find((s) => s.key === k)).filter(
  (s): s is Section => s != null,
);

// A few signature flows surfaced as a "menu" inside the hero visual (logged-out marketing only).
const HERO_PREVIEW: { emoji: string; title: string; meta: string }[] = [
  { emoji: "🍳", title: "Tonight: Lemon herb chicken", meta: "have 7/8 · uses spinach" },
  { emoji: "🛒", title: "Reorder ready", meta: "6 staples due · 1 tap to cart" },
  { emoji: "♻️", title: "Use it up", meta: "2 items expiring soon" },
];

/**
 * One compact, calm stat card for the focused dashboard. Shows a real count + label and links to the
 * screen that acts on it. Callers only render this when the count is meaningful (>0), so there are no
 * fake/zero numbers on the home.
 */
function StatCard({
  href,
  emoji,
  value,
  label,
}: {
  href: string;
  emoji: string;
  value: string | number;
  label: string;
}) {
  return (
    <a href={href} className="group card-link">
      <div className="flex items-start justify-between">
        <span className="tile">{emoji}</span>
        <span className="text-ink-300 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          →
        </span>
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-ink-900">{value}</div>
      <div className="mt-1 text-sm text-ink-500">{label}</div>
    </a>
  );
}

export default async function HomePage() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email ?? null;
  // Only hit the DB for signed-in visitors; the logged-out landing path stays query-free.
  const { streak, expiringCount, listCount, firstRun } = session
    ? await loadHomeData()
    : { ...EMPTY_HOME_DATA, firstRun: null as FirstRun | null };
  // Show the activation checklist only while there's setup left and the user hasn't dismissed it.
  const showGettingStarted =
    firstRun != null &&
    !firstRun.dismissed &&
    !(firstRun.tasteSet && firstRun.hasPantry && firstRun.hasCooked);
  // Live status cards only appear when their real count is meaningful — no zero-filled placeholders.
  const hasStats = streak > 0 || expiringCount > 0 || listCount > 0;

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
              <a href="/tools" className="btn-ghost btn-sm hidden sm:inline-flex">
                All tools
              </a>
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

      {/* Signed-in users land on a FOCUSED dashboard: a lean greeting, ≤3 primary actions, a few
          LIVE status cards (real counts only), and one quiet link to the full "All tools" index.
          The marketing hero/pitch below renders for LOGGED-OUT visitors only. */}
      {session && (
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-12">
          <p className="eyebrow">Your kitchen</p>
          <h1 className="page-title mt-3">Welcome back</h1>
          <p className="page-subtitle">
            Jump back in — plan your week, cook what you have, or ask your kitchen anything.
          </p>

          {/* Primary actions — the three things worth doing now. */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href="/plan" className="btn-primary px-5 py-3 text-base">
              Plan my week →
            </a>
            <a href="/recipes" className="btn-secondary px-5 py-3 text-base">
              Cook tonight
            </a>
            <a href="/ask" className="btn-ghost px-5 py-3 text-base">
              Ask your kitchen
            </a>
          </div>

          {/* Live status — only the cards whose real count is meaningful (>0). */}
          {hasStats && (
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {streak > 0 && (
                <StatCard
                  href="/digest"
                  emoji="🔥"
                  value={`${streak}-day`}
                  label="Cooking streak"
                />
              )}
              {expiringCount > 0 && (
                <StatCard
                  href="/use-it-up"
                  emoji="♻️"
                  value={expiringCount}
                  label={expiringCount === 1 ? "item to use up" : "items to use up"}
                />
              )}
              {listCount > 0 && (
                <StatCard
                  href="/list"
                  emoji="🛒"
                  value={listCount}
                  label={listCount === 1 ? "item on your list" : "items on your list"}
                />
              )}
            </div>
          )}

          {/* Everything else lives one tap away — progressive disclosure, not a wall of tiles. */}
          <div className="mt-8">
            <a href="/tools" className="nav-link">
              All tools →
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

          {/* Highlights — a short flagship set (not the full catalog) + a link to everything. */}
          <section className="mx-auto max-w-6xl px-5 pb-8 pt-16 sm:px-8 sm:pt-24">
            <div className="mb-10 text-center">
              <p className="eyebrow justify-center">Everything in one place</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-ink-900 sm:text-4xl">
                One app for the whole kitchen
              </h2>
              <p className="page-subtitle mx-auto text-center">
                From the moment a receipt lands to the meal on your plate — here&apos;s a taste of what
                it does for you.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {HIGHLIGHTS.map((s, i) => (
                <FeatureCard key={s.key} s={s} index={i} />
              ))}
            </div>

            <div className="mt-10 text-center">
              <a href="/signup" className="nav-link">
                See everything →
              </a>
            </div>
          </section>
        </>
      )}

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
