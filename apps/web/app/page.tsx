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
import { assessOrderReadiness } from "@gm/core/reorder";
import { buildDigest, type DigestSummary } from "@gm/core/digest";
import { currentUserId } from "@/app/lib/tenant";
import { titleCase } from "@/app/lib/format";
import { buildDigestForUser } from "@/app/lib/digest";
import { GettingStarted, type FirstRunState } from "@/app/components/getting-started";
import { FeatureCard } from "@/app/components/feature-card";
import { SECTIONS, type Section } from "@/app/lib/sections";
import {
  ArrowRight,
  Check,
  ChefHat,
  Flame,
  Leaf,
  Package,
  Recycle,
  ShoppingCart,
  type LucideIcon,
} from "@/app/components/icons";

// Topics onboarding writes that mean "the user told us their taste". profile:* (written at signup)
// is excluded on purpose — counting it would mark step 1 done for every brand-new account.
const TASTE_KINDS = ["diet:", "allergen:", "cuisine:", "ingredient:", "quality:"];
const DISMISSED_TOPIC = "dismissed_getting_started";

type FirstRun = FirstRunState & { dismissed: boolean };
/**
 * Live, real-data home model: the cooking streak, the active-list count, the autopilot digest
 * (what's due to reorder — with when-to-buy dates — and what's expiring), and first-run flags.
 */
/** A pantry snapshot for the home: how much is tracked, how much is running low/out, and how many
 *  items are flagged likely-expired (needing a quick review). */
type PantryStats = { tracked: number; low: number; expiredReview: number };
type HomeData = {
  streak: number;
  listCount: number;
  digest: DigestSummary;
  pantry: PantryStats;
  firstRun: FirstRun;
};

const EMPTY_FIRST_RUN: FirstRun = {
  tasteSet: false,
  hasPantry: false,
  hasCooked: false,
  dismissed: false,
};

// A quiet, all-zero digest for the logged-out / error paths — no fake data on the home.
const EMPTY_DIGEST: DigestSummary = buildDigest({
  expiring: [],
  reorderDue: [],
  spentThisWeekCents: 0,
  homeCookedThisWeek: 0,
});

const EMPTY_HOME_DATA: HomeData = {
  streak: 0,
  listCount: 0,
  digest: EMPTY_DIGEST,
  pantry: { tracked: 0, low: 0, expiredReview: 0 },
  firstRun: EMPTY_FIRST_RUN,
};

/**
 * Signed-in home data for the grocery-autopilot dashboard: the cooking streak, the active-list count,
 * and the autopilot digest (what's due to reorder — with when-to-buy dates — and what's expiring),
 * plus the first-run activation flags. Reuses `buildDigestForUser` so the home and /digest can't
 * drift. Batches the reads into one `withTenant` transaction (RLS). Everything is REAL — derived from
 * pantry / reorder / list rows, never placeholders — and any DB/auth hiccup degrades to a quiet,
 * all-zero model. Only call for a real session; the logged-out landing path stays query-free.
 */
async function loadHomeData(): Promise<HomeData> {
  try {
    const userId = await currentUserId();
    if (!userId) return EMPTY_HOME_DATA;
    const now = new Date();

    const { signals, pantry, cookedAt, list, digest } = await withTenant(getDb(), userId, async (tx) => {
      // Load the pantry once and hand it to the digest (it would otherwise re-query it) — this is the
      // most-hit page, so a duplicate getPantryView per load is worth removing.
      const pantry = await getPantryView(tx, userId);
      const [signals, cookedAt, list, digest] = await Promise.all([
        loadPreferenceSignals(tx, userId),
        loadCookedAt(tx, userId),
        getActiveListView(tx, userId),
        buildDigestForUser(tx, userId, now, pantry),
      ]);
      return { signals, pantry, cookedAt, list, digest };
    });

    return {
      streak: currentStreak(cookedAt, now),
      // Unchecked items on the active shopping list.
      listCount: list.filter((i) => !i.checked).length,
      digest,
      pantry: {
        tracked: pantry.length,
        low: pantry.filter((p) => p.status === "low" || p.status === "out").length,
        expiredReview: pantry.filter((p) => p.status === "expired_likely").length,
      },
      firstRun: {
        tasteSet: signals.some((s) => TASTE_KINDS.some((k) => s.topic.startsWith(k))),
        hasPantry: pantry.length > 0,
        hasCooked: cookedAt.length > 0,
        // Treat finishing onboarding as dismissing the checklist too — otherwise it lingers showing a
        // half-done state (e.g. taste "not done") right after setup, which reads as a bug.
        dismissed:
          signals.some((s) => s.topic === DISMISSED_TOPIC) || signals.some((s) => s.topic === "onboarded"),
      },
    };
  } catch {
    return EMPTY_HOME_DATA;
  }
}

// Logged-out highlights: a short flagship set (not the full ~20). Picked from the shared catalog by
// key so titles/blurbs/icons can't drift from /tools. Conversion-focused, calm.
const HIGHLIGHT_KEYS = ["pantry", "recipes", "plan", "discover", "spend", "wrapped"];
const HIGHLIGHTS: Section[] = HIGHLIGHT_KEYS.map((k) => SECTIONS.find((s) => s.key === k)).filter(
  (s): s is Section => s != null,
);

// A few signature flows surfaced as a "menu" inside the hero visual (logged-out marketing only).
const HERO_PREVIEW: { icon: LucideIcon; title: string; meta: string }[] = [
  { icon: ChefHat, title: "Tonight: Lemon herb chicken", meta: "have 7/8 · uses spinach" },
  { icon: ShoppingCart, title: "Reorder ready", meta: "6 staples due · 1 tap to cart" },
  { icon: Recycle, title: "Use it up", meta: "2 items expiring soon" },
];

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Friendly "when to buy" label from a recommend-by date (UTC, matching the stored value). */
function buyBy(d: Date | null): string {
  if (!d) return "soon";
  const date = new Date(d);
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "buy now";
  if (days === 1) return "tomorrow";
  if (days <= 6) return `by ${DOW[date.getUTCDay()]}`;
  return `in ${days}d`;
}

/** Friendly expiring label (mirrors the /digest + /use-it-up wording). */
function expiringLabel(e: { reason: string; daysLeft: number | null }): string {
  if (e.reason === "expired_likely") return "likely expired";
  if (e.daysLeft != null && e.daysLeft <= 0) return "use today";
  return e.daysLeft != null ? `${e.daysLeft}d left` : "soon";
}

export default async function HomePage() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email ?? null;
  // Only hit the DB for signed-in visitors; the logged-out landing path stays query-free.
  const { streak, listCount, firstRun, digest, pantry } = session
    ? await loadHomeData()
    : { ...EMPTY_HOME_DATA, firstRun: null as FirstRun | null };
  // Show the activation checklist only while there's setup left and the user hasn't dismissed it.
  const showGettingStarted =
    firstRun != null &&
    !firstRun.dismissed &&
    !(firstRun.tasteSet && firstRun.hasPantry && firstRun.hasCooked);
  // Autopilot status — an honest, item-aware verdict on the grocery run (deterministic; rendered on
  // every load). "Time to order" when something runs out soon, "Ready to order" once it's a worthwhile
  // size, else a quiet building/clear state. Urgency reads the real recommend-by dates.
  const readiness = assessOrderReadiness({
    reorderCount: digest.reorderCount,
    dueDates: digest.topReorder.map((r) => r.recommendByDate),
    listCount,
    now: new Date(),
  });
  const runLine =
    digest.reorderCount > 0 && listCount > 0
      ? `${digest.reorderCount} to reorder · ${listCount} on your list`
      : digest.reorderCount > 0
        ? `${digest.reorderCount} ${digest.reorderCount === 1 ? "item" : "items"} to reorder`
        : `${listCount} ${listCount === 1 ? "item" : "items"} on your list`;

  return (
    <main className="relative overflow-hidden">
      {/* Sticky top nav — solid, calm surface (no frost/blur). */}
      <header className="glass-nav sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <a href="/" className="flex items-center gap-2.5">
            <span className="tile-brand h-9 w-9">
              <Leaf className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="text-base font-semibold tracking-[-0.01em] text-ink-900">GroceryManager</span>
          </a>
          {session ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {streak > 0 && (
                <a href="/digest" className="pill-brand hidden sm:inline-flex" title="Your cooking streak">
                  <Flame className="h-4 w-4" strokeWidth={2} /> {streak}-day streak
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
        <section className="mx-auto max-w-2xl px-5 pb-16 pt-10 sm:px-8 sm:pt-12">
          <p className="eyebrow">Your kitchen, on autopilot</p>
          <h1 className="page-title mt-3">Welcome back</h1>

          {/* Autopilot status — an honest, item-aware verdict (Time to order / Ready to order / building
              / all-stocked). Instacart is deep-link only, so the promise is: drafted for you, one tap to order. */}
          <section className="panel-brand mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
              {readiness.state === "clear" ? "On autopilot" : readiness.headline}
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold">
              {readiness.state === "clear" ? "You're all stocked up." : runLine}
            </h2>
            <p className="mt-1 text-sm text-white/90">{readiness.reason}</p>
            {readiness.state === "clear" && digest.nextRunOutAt && (
              <p className="mt-2 text-sm text-white/80">
                Next grocery run likely {buyBy(digest.nextRunOutAt)}.
              </p>
            )}
            {readiness.state !== "clear" && (
              <a
                href="/list"
                className="btn mt-4 inline-flex bg-white px-5 py-3 text-base text-brand-solid hover:bg-white/90"
              >
                {readiness.state === "building" ? "Review list →" : "Review & order →"}
              </a>
            )}
          </section>

          {/* Pantry snapshot — the core log, always one tap away (also where likely-expired items are
              reviewed). Shows a fill CTA when empty so it's never a dead-end. */}
          <a href="/pantry" className="card-link mt-6 block">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="tile shrink-0">
                  <Package className="h-5 w-5" strokeWidth={2} />
                </span>
                <div>
                  <h2 className="section-title">Pantry</h2>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {pantry.tracked === 0
                      ? "Empty — fill it from receipts, a scan, or a quick add."
                      : `${pantry.tracked} item${pantry.tracked === 1 ? "" : "s"} tracked` +
                        (pantry.low > 0 ? ` · ${pantry.low} running low` : "") +
                        (pantry.expiredReview > 0 ? ` · ${pantry.expiredReview} to review` : "")}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-ink-300" strokeWidth={2} aria-hidden />
            </div>
          </a>

          {/* When to buy — upcoming reorders with their recommend-by dates. */}
          {digest.topReorder.length > 0 && (
            <section className="card-pad mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="section-title">When to buy</h2>
                <a href="/list" className="nav-link">Review →</a>
              </div>
              <ul className="space-y-2 text-sm">
                {digest.topReorder.map((r) => (
                  <li key={r.name} className="flex items-center justify-between gap-4">
                    <span className="flex min-w-0 items-center gap-2.5 text-ink-800">
                      <span className="tile h-8 w-8">
                        <ShoppingCart className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <span className="truncate">{titleCase(r.name)}</span>
                    </span>
                    <span className="shrink-0 text-ink-400">{buyBy(r.recommendByDate)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Use it up — what's about to spoil, with one-tap rescue recipes. */}
          {digest.topExpiring.length > 0 && (
            <section className="card-pad mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="section-title">Use it up</h2>
                <a href="/use-it-up" className="nav-link">Recipes →</a>
              </div>
              <ul className="space-y-2 text-sm">
                {digest.topExpiring.map((e) => (
                  <li key={e.name} className="flex items-center justify-between gap-4">
                    <span className="flex min-w-0 items-center gap-2.5 text-ink-800">
                      <span className="tile h-8 w-8">
                        <Recycle className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <span className="truncate">{titleCase(e.name)}</span>
                    </span>
                    <span className="shrink-0 text-ink-400">{expiringLabel(e)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Quick actions — secondary to the autopilot status above. */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="/plan" className="btn-primary px-5 py-3 text-base">
              Plan my week →
            </a>
            <a href="/recipes" className="btn-secondary px-5 py-3 text-base">
              Cook tonight
            </a>
            <a href="/pantry" className="btn-ghost px-5 py-3 text-base">
              Pantry
            </a>
            <a href="/list" className="btn-ghost px-5 py-3 text-base">
              Shopping list
            </a>
            <a href="/ask" className="btn-ghost px-5 py-3 text-base">
              Ask your kitchen
            </a>
            <a href="/add-receipt" className="btn-ghost px-5 py-3 text-base">
              Snap a receipt
            </a>
          </div>

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
                  Always know what to cook, and what to buy.
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-500">
                  It tracks what&apos;s in your kitchen, flags what you&apos;re about to run out of,
                  builds the order, and suggests meals you can cook tonight — food and household
                  essentials alike.
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
                    <Check className="h-4 w-4 text-brand-600" strokeWidth={2} /> Fills from your receipts
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-brand-600" strokeWidth={2} /> No bank link needed
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-brand-600" strokeWidth={2} /> Works offline
                  </span>
                </div>
              </div>

              {/* Hero visual: one calm "today" card — no glow, stickers, or shimmer. */}
              <div className="animate-fade-in [animation-delay:120ms]">
                <div className="card-pad">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="eyebrow">This week</div>
                      <div className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink-900">
                        Your kitchen, on autopilot
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 space-y-2.5">
                    {HERO_PREVIEW.map((p) => (
                      <div
                        key={p.title}
                        className="flex items-center gap-3 rounded-xl border border-line bg-cream px-3.5 py-3"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-600 ring-1 ring-inset ring-line">
                          <p.icon className="h-5 w-5" strokeWidth={2} />
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
                    <ArrowRight aria-hidden className="h-5 w-5" strokeWidth={2} />
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
          <span className="tile-brand h-9 w-9">
            <Leaf className="h-5 w-5" strokeWidth={2} />
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
