# Improvement Log

Dated entries from each autonomous loop run.

---

## 2026-06-25 (run 12) — Track F world-class quality (F1–F5 complete)

**DEEP AUDIT (3 critical bugs merged):**

- **PR #119 — Stripe webhook fail-closed:** Webhook was fail-open when `STRIPE_WEBHOOK_SECRET` absent
  — any client could forge entitlement writes. Fixed: fail 400 in ALL environments when secret absent;
  `stripeVerificationWired: boolean = false` pattern preserves TypeScript narrowing downstream.
- **PR #120 — Google auth uid-less session:** Cold sign-in failure produced a uid-less session token
  that passed as a valid session. Fixed: `return null` from `jwt()` denies session in next-auth v5.
- **PR #121 — Meal log non-null assertions:** `logCook` used `!` on Drizzle `.returning()` results —
  a failed insert (constraint violation, connection error) would `undefined.id` → corrupt pantry ledger.
  Fixed: explicit guards throw before data-corruption path.

**Track F (quality) — all 5 sub-tracks merged:**

- **F1 (PR #122):** ESLint flat config (v9) for `apps/web/app/`, `--max-warnings=0` enforcement.
- **F2 (PR #123):** Coverage thresholds (lines ≥70%, branches ≥84%, functions ≥76%) in
  `packages/core/vitest.config.ts`; `test` script runs `--coverage` so CI enforces the floor.
- **F3 (PR #124):** `scripts/run-evals.sh` — gated LLM eval runner with path-injection prevention.
- **F4 (PR #125):** Playwright E2E smoke suite — `playwright.config.ts` + `e2e/smoke.spec.ts`
  covering all 7 public routes, 3 A/B landing variants, share graceful-404.
- **F5 (this run):** DEEP AUDIT findings recorded; LOOP_MEMORY updated with 3 new lessons.

**Gate:** typecheck ✓ · 450 core tests ✓ (incl. coverage thresholds) · `next build` ✓

---

## 2026-06-25 (run 11) — Preflight gate + rendered store assets

**PR #112 — preflight gate + icon PNGs + feature graphic (merged):**
Final factory artifact completing the STOP CONDITION's evidence-based requirement.
(1) **`scripts/preflight.sh`** — full pre-flight gate: runs `pnpm -r run typecheck`,
`pnpm --filter @gm/core test`, `NODE_ENV=production next build` (+ missing-export grep),
and `cd apps/mobile && npm ci && npm run typecheck`. Asserts all 11 required docs,
ACCEPTANCE_AUDIT.md zero FAILs, BUSINESS_CASE.md sections, 7 Track E marketing routes,
and all 6 store-asset PNGs. Warns (not fails) on Human Core items (device screenshots).
Result: **36 PASS / 0 FAIL / 2 Human Core warnings**. (2) **`scripts/generate-store-assets.mjs`**
— Playwright/Chromium one-shot script that renders `icon.svg` to PNG at 1024/512/192 px
(opaque RGB — no alpha, satisfying App Store/EAS requirement) plus Android adaptive icon
(transparent RGBA — correct for adaptive system) and Google Play feature graphic (1024×500,
brand-green, leaf icon + wordmark). (3) **Committed PNG artifacts** — `icon-1024.png` (36K),
`icon-512.png` (16K), `icon-192.png` (8K), `apps/mobile/assets/icon.png` (EAS),
`apps/mobile/assets/adaptive-icon.png`, `docs/store/assets/feature-graphic.png` (24K).
(4) **`apps/mobile/app.json`**: added `"icon": "./assets/icon.png"` (correct EAS wiring).
(5) **`manifest.webmanifest`**: PNG icon entries added alongside SVG (Safari PWA compatibility).
Review: two cycles — cycle 1 REQUEST_CHANGES (BUILD_EXIT capture bug, alpha channel); cycle 2
APPROVE after fixes. Gates: typecheck, 450 core tests, `next build`, mobile typecheck all green.

---

## 2026-06-24 (run 9) — Track E: marketing engine, waitlist DB, A/B variants, launch handoff

**PR #106 — Track E marketing engine: blog, waitlist DB, social proof, admin (merged):**
Three deliverables shipped together: (1) **Blog** — `apps/web/app/blog/posts.ts` (3 SEO-targeted
posts: food waste, meal planning, grocery budget), `/blog` index, `/blog/[slug]` dynamic renderer
with `generateStaticParams` + `generateMetadata`; `/blog` added to middleware PUBLIC allowlist (was
behind auth wall — crawlers got redirected to `/signin`). (2) **Waitlist DB** — migration
`0012_waitlist.sql` (`waitlist_submissions` table + unique email index), wired into `migrate.ts`;
`insertWaitlistEmail` + `getWaitlistSubmissions` query helpers added to `packages/db/src/queries.ts`
(drizzle `sql` tag, RowList-as-array cast pattern, 7-day count via DB-side FILTER clause);
`submitWaitlistEmail` server action updated from stdout-only to DB-backed (`getAdminDb()`, RFC 5321
validation, no PII in logs); `/admin/waitlist` page updated to use `data.lastSevenDays` (DB-accurate).
(3) **Admin layout** — fail-fast log when `ADMIN_EMAIL` is absent; case-insensitive email comparison.
Also added `/help`, `/privacy`, `/terms` to middleware PUBLIC allowlist (SEO + App Store review
requirement). Sitemap extended with blog entries + those three routes.

**PR #108 — A/B landing hero variants ?v=a/b/c (merged):**
Three hero copy variants served via `searchParams.v` in `apps/web/app/page.tsx` (`HERO_VARIANTS`
constant; `data-ab-variant` attribute for Plausible analytics). Secondary CTA changed from `/recipes`
(auth-gated dead end) to `/signin`. Variant C "7-day free trial" trust badge changed to "No credit
card to start" (billing not live). Placeholder testimonial comment moved from visible DOM text to JSX
comment. Created on clean branch from `origin/main` after cherry-picking only the A/B commits from
a stale branch that had an unresolvable rebase conflict with PR #106 (already merged to main).

**Gate:** typecheck ✓ · core tests ✓ · next build ✓ · no missing-export warnings ✓

**ROADMAP ticks:** Track E fully complete. All buildable items shipped. Human Core remainder:
rendered store screenshots + live billing/EAS keys (see PENDING_OPS.md and docs/LAUNCH.md).

---

## 2026-06-24 (run 8) — Track B: push notification infrastructure + token persistence

**PR #97 — Push token server API (merged):**
Server-side infrastructure for Expo push notifications: `push_tokens` DB table (migration
`0011_push_tokens.sql` with RLS via `grocery_app` + `app_current_user_id()` GUC, matching the
tenant isolation model in `0002_rls.sql`), Drizzle schema + `registerMobilePushToken` /
`deregisterMobilePushToken` query helpers in `@gm/db`, and `POST /DELETE /api/mobile/push-token`
endpoint (Expo token format validated with `/^ExponentPushToken\[[A-Za-z0-9_-]{10,64}\]$/` on
both handlers; `withTenant` isolation; `deviceId` ≤ 200 chars guard).

**PR #98 — Mobile push notifications + token persistence (merged):**
Client-side completion: `expo-notifications@^56.0.18` + `expo-device@^56.0.4` + 
`@react-native-async-storage/async-storage@^3.1.1` added to `apps/mobile`. 
`lib/notifications.ts`: permission request → `getExpoPushTokenAsync` → POST to server;
Android 13+ channel; fully best-effort (try/catch throughout); gated on `EXPO_PUBLIC_PROJECT_ID`
(no-op until Human Core sets EAS project ID). `lib/auth.tsx`: session persisted to AsyncStorage
on login and restored on cold launch — eliminates the re-login-every-restart regression; 
`ready` flag exposes hydration status. `app/_layout.tsx`: `AppStack` inner component reads
`ready`, shows branded `ActivityIndicator` while AsyncStorage loads — prevents flash-to-login.

**Gate:** typecheck ✓ (web + mobile) · 450+ core tests ✓ · next build ✓

**ROADMAP ticks:** Track B push notifications code fully wired — remaining Human Core: set
`EXPO_PUBLIC_PROJECT_ID` (EAS project ID) + apply migration 0011 (`pnpm --filter @gm/db db:migrate`).

---

## 2026-06-24 (run 7) — Track C premium gates + Track B pull-to-refresh + hooks fix

**PR #95 — premium gates on spend/wrapped (web + mobile) + pull-to-refresh + hooks fix (merged):**
Four commits, 9 files.

- **Revenue leak fix:** `apps/web/app/spend/page.tsx` and `apps/web/app/wrapped/page.tsx` both
  served premium features (`spend_insights`, `wrapped_plus`) to all users — `canUse()` was never
  called despite both features appearing in `PREMIUM_FEATURES`. Added `loadPreferenceSignals` to the
  `Promise.all` in each page's `withTenant` block; guard redirects free-tier users to `/upgrade`
  when `FEATURE_BILLING=1`. Same gate applied to `apps/web/app/api/mobile/spend/route.ts` and
  `apps/web/app/api/mobile/wrapped/route.ts` (returns `{ upgradeRequired: true }` for free tier).
  `apps/mobile/app/spend.tsx` and `apps/mobile/app/wrapped.tsx` handle the flag with a native
  upgrade card UI (`Link href="/upgrade"` to the upgrade screen).
- **Pull-to-refresh (mobile):** Added `RefreshControl` to `pantry.tsx`, `list.tsx`,
  `cook-tonight.tsx` with `tintColor="#0c8a3e"`. Load functions accept `refresh: boolean = false`
  — PTR skips `setLoading(true)` so the list stays visible under the native spinner overlay.
  `onRefresh` calls `load(true)`; retry button calls `() => load()` (avoids TypeScript
  `GestureResponderEvent` incompatibility).
- **Rules-of-Hooks fix (spend.tsx, wrapped.tsx, pantry.tsx):** `useEffect(load, [token])` moved
  before the `if (!token) return <Redirect>` conditional return; `if (!token) return () => {};`
  guard added inside the load callback. Eliminates "Rendered fewer hooks than expected" crash on
  token transitions.

**ROADMAP tick-offs this run (housekeeping PR):** Track B boxes ticked: core screens (18 screens,
full parity), mobile CI green, EAS build config staged. DoD boxes ticked: Track A, C, D, E.
Track B DoD remains open: push notifications (EAS project ID — Human Core).

**Gate:** `verify` ✓ · `mobile` ✓ · `migrations` ✓.

---

## 2026-06-24 (run 5) — Track B mobile parity: token sweep, Discover, Digest, Use-it-up

**PR #85 — mobile design token sweep (merged):** Swept all remaining mobile screens (`capture`,
`upgrade`, `profile`, `login`, `recipes`, `index`, `cook/[id]`) for off-token hex values.
`#9ba8b4` → `#a3acb5` (ink-300 exact), `#fdeceb` → `#fdecea` (danger-soft exact), `#991b1b`
→ `#8e261b` (danger-ink). Completes the work PR #71 started — zero off-token values now remain
across all 13 mobile app files. Gate: `verify` ✓ · `mobile` ✓.

**PR #86 — Discover swipe feed (merged):** `GET /api/mobile/discover` (pantry→TheMealDB→rank
→`nextDiscoveryBatch` filtered by `loadSeenRecipeIds`; up to 12 cards) + `POST /api/mobile/discover`
(`swipeToSignals` → `recordSwipeSignals` — writes `recipe_seen` + `cuisine:<x>` affinity signal to
preference ledger, same flywheel as web). `apps/mobile/app/discover.tsx`: card stack with `https://`-
gated image, cuisine label, pantry-match chip, Like/Skip buttons, progress counter, ghost-card hint,
"Cook this recipe →" deep-link, auto-reload on deck exhaustion. No gesture library — buttons-first.
Gate: `verify` ✓ · `mobile` ✓ · `migrations` ✓.

**PR #88 — Cooking streak & stats screen (merged):** `GET /api/mobile/digest` — loads `loadCookLog`,
derives `currentStreak` / `longestStreak` / `cooksThisWeek` / `totalCooks` / `weeklyActivity(8)` from
pure `@gm/core/recipe` streak helpers (0 new logic). `apps/mobile/app/digest.tsx`: brand-green streak
hero (72px number), 3-column stat row, 8-week proportional bar chart (Mon-start, date labels), CTA
buttons to cook log + cook tonight. Retry via attempt counter. Home nav card added. Gate: `verify` ✓
· `mobile` ✓ · `migrations` ✓.

**PR #90 — Use it up screen (merged):** `GET /api/mobile/use-it-up` — `selectExpiringSoon(grocery,
withinDays:5, excludeExpired:true)`, seeds TheMealDB with expiring item names, ranks then filters
`usesExpiring > 0`. Returns up to 10 recipes + expiring list (name + daysLeft). Typecheck fix: filter
runs on `RankedRecipe` (not `MatchRecipe`) since `usesExpiring` is computed during ranking.
`apps/mobile/app/use-it-up.tsx`: amber "Use these up soon" banner (at-risk items + days-left chips),
FlatList recipe cards with "Uses N expiring" + pantry-coverage badges, tap → cook mode, empty state.
Home nav card added. Gate: `verify` ✓ · `mobile` ✓ · `migrations` ✓.

**Track B status after run 5:** Native Expo mobile app has full feature parity with the web across
15 screens: Login, Onboarding, Home, Pantry, Shopping list, Cookbook, Cook mode, Cook tonight,
Discover, Use it up, Meals & macros, Cooking stats, Quick add, Profile, Upgrade. All mobile API
routes backed (`/api/mobile/*`). Zero off-token hex values. No emoji. All retry patterns use attempt
counter. All image renders `https://`-gated. Track B is functionally complete.

---

## 2026-06-24 (run 4) — Track B mobile parity: cook-tonight, onboarding wizard, meals/macros log

**PR #76 — cook-tonight screen (merged):** `GET /api/mobile/cook-tonight` (pantry-ranked recipe
suggestions reusing existing `getCookTonightCandidates`). Native `apps/mobile/app/cook-tonight.tsx`:
ranked recipe cards with pantry-match indicator, pull-to-refresh, loading/error/empty states. Index
nav card added. Gate: `verify` ✓ · `mobile` ✓.

**PR #83 — mobile onboarding wizard (merged):** `GET /api/mobile/onboarding` (check status) +
`POST` (actions: profile / taste / finish). Three-step taste wizard: Profile → Diets/Allergens →
Cuisines/Taste → Done. Chip multi-selects for 8 diets, 8 allergens, 8 cuisines; text inputs for
loved/avoided ingredients. Writes to the same preference-signal ledger as the web wizard.
`finish` is idempotent (pre-checks `isOnboarded`). Home screen gates on onboarding status —
`null` loading returns `null` (no flash), `false` redirects to `/onboarding`.
Reviewer fixes: `humanizeChip` split on `/[-\s]+/` (fixes "tree nut"), exact hex tokens
(`#a3acb5` ink-300, `#fdecea` danger-soft). Gate: `verify` ✓ · `mobile` ✓ · `migrations` ✓.

**PR #84 — meals & macros log screen (merged):** `GET /api/mobile/cooked` (returns up to 30 cook-log
entries from `loadCookLog` — id, title, imageUrl, cookedAt ISO, servingsMade, kcal/proteinG/carbsG/fatG).
`try/catch` wraps the DB call; 500 on failure. Native `apps/mobile/app/cooked.tsx`: today's macro
summary panel (brand-green, running totals), FlatList of meal cards with `https://`-gated image
rendering (first-letter text mark fallback), retry via `attempt` counter in `useEffect` deps
(fix for retry-not-refetching bug). Empty state and image placeholder use branded text marks —
no emoji. Gate: `verify` ✓ · `mobile` ✓.

---

## 2026-06-24 (run 3) — Track A quality pass (design bar / reliability / performance) + Track B mobile screens

**PR #56 — loading skeletons + parallel profile (merged):** Added `loading.tsx` skeleton files for
3 routes that were missing them (the last gap in the 27-route skeleton coverage). Parallelized the
profile page DB reads from sequential to `Promise.all`. Gate: `verify` ✓. Advances Track A (design
bar + reliability — all major routes now have error boundary + skeleton).

**PR #62 — mobile auth + pantry screen (merged):** Added `/api/mobile/auth` (POST credentials →
HMAC-SHA256 JWT with AUTH_SECRET, 7-day TTL, returns `{token, userId, name}`) and `/api/mobile/pantry`
(GET Bearer → `withTenant` → `getPantryView`). Native `apps/mobile/app/pantry.tsx`: real FlatList with
expiry color-coding (red ≤2d, amber ≤5d, neutral otherwise), loading/error/retry/empty states, auth
guard. Gate: `verify` ✓. Advances Track B (first real pantry screen on native).

**PR #65 — parallel digest + pantry DB reads (merged):** `apps/web/app/digest/page.tsx` — changed
from one `withTenant` with two sequential awaits to `Promise.all([withTenant(…digest…),
withTenant(…cookedAt…)])` using separate connections. `apps/web/app/pantry/page.tsx` — `getPantryView`
first (to get canonical IDs), then 5 independent reads (`getGoogleCredential`, `getReviewQueue`,
`getLatestSourcesByCanonical`, `getLatestAcquisition`, `isOnboarded`) run in `Promise.all` via
separate `withTenant` connections. Gate: `verify` ✓. Closes the last performance gap found in
the run-3 audit — Track A Performance complete.

**PR #68 — shopping list screen (merged):** Added `/api/mobile/list` (GET Bearer →
`withTenant` → `getActiveListView`, returns `{items}`). Native `apps/mobile/app/list.tsx`: FlatList
of unchecked items with `REASON_LABEL` map (`manual / reorder_engine / recipe_plan / agent`), green
dot indicator, loading/error/retry/empty states, auth guard. Gate: `verify` ✓. Advances Track B.

**PR #69 — consistent LLM/Vertex keyless guards (merged):** Applied uniform fail-closed keyless
fallback guards to the scan, import, and add-receipt routes — every LLM path now wraps the Vertex
call in try/catch and degrades gracefully when `GEMINI_API_KEY` is absent. Closes the last
reliability gap found in the run-3 audit — Track A Reliability complete.

**PR #70 — cookbook/recipes screen (merged):** Added `/api/mobile/recipes` (GET Bearer →
`withTenant` → `loadSavedRecipes` → `dedupeSaved`). Native `apps/mobile/app/recipes.tsx`: FlatList
of saved recipes with title + cuisine, loading/error/retry/empty states, auth guard. Added
"Cookbook →" nav card to `apps/mobile/app/index.tsx`. Also regenerated `apps/mobile/package-lock.json`
to sync with expo-router 56.2.11 transitive deps (fixes `npm ci` in the mobile CI job). Gate: `verify` ✓.
Advances Track B (cookbook screen done; remaining: cook + cook-mode, capture/scan).

**PR #71 — mobile design-token hex values (merged):** Corrected all off-token color values across
three mobile screens (`pantry.tsx`, `list.tsx`, `login.tsx`) — Tailwind palette approximations
replaced with exact hex from `globals.css` CSS variable RGB tuples (`--danger` #c0392b,
`--danger-soft` #fdeceb, `--danger-ink` #8e261b, `--warn` #b6791a, `--ink-700` #2b333d). Also
replaced emoji 🧺 logo in `login.tsx` with a branded `GM` mark (#0c8a3e rounded square) per
BRAND_KIT rule. Gate: `verify` ✓ · `mobile` ✓. Advances Track B design bar.

**PR #72 — Vertex AI guard extended to ask/plan/remix/onboarding (merged):** Four page-level
files used only `GEMINI_API_KEY` as an AI capability flag, so Vertex-only deployments saw AI
as "unavailable" for ask/plan/remix/onboarding even when fully configured. Fixed by gating on
`GEMINI_API_KEY || GOOGLE_VERTEX_PROJECT` in all four. Follow-up to PR #69. Gate: `verify` ✓.
Closes Track A Reliability fully — all LLM capability checks now Vertex-aware.

**PR #75 — recipes browser + cook mode native screens (merged):** Added
`GET /api/mobile/recipes/[id]` (UUID→DB via `loadRecipeForCook`; numeric→TheMealDB provider;
returns full recipe with ingredients). Replaced the simpler PR #70 recipes screen with a richer
`apps/mobile/app/recipes.tsx`: thumbnail Image (72×72), pull-to-refresh via RefreshControl, `Link
href={/cook/${id}}` navigation, text placeholder box (no emoji). New `apps/mobile/app/cook/[id].tsx`:
hero image, ingredient list with bullet + measure + name, step-through cook mode (Prev / Next /
"Start over" on last step), auth redirect guard (`if (!token) return <Redirect href="/login" />`),
loading/error/not-found states. Gate: `verify` ✓. Advances Track B: cook + cook-mode done;
remaining: capture/scan, then parity screens.

---

## 2026-06-24 (run 2) — feat(pwa): browser favicon + mobile screens (Track D + Track B)

**PR #60 — favicon (merged):** Wired `/icons/icon.svg` (already used by the PWA manifest) as the
browser-tab icon via Next.js App Router `metadata.icons`. One-line change in `apps/web/app/layout.tsx`.
Gate: `verify` ✓, `mobile` ✓ (pre-existing lock-file gap on main, `verify` was the only required
gate). Advances Track D (stability pass — browser favicon now correct).

**PR #64 — mobile screens (opened then closed, superseded):** Implemented sign-in screen
(`signin.tsx`), real pantry FlatList (`pantry.tsx`), shopping list screen (`list.tsx`), and API
client (`app/lib/api.ts`) using the `/api/v1/*` endpoints from PR #59. Two independent reviewer
agents approved after fixes (401 handling, `data.token` validation, design-token colors, `titleCase`
ALL-CAPS fix, dead `(tabs)` route removed, no hardcoded prod URL). However, a concurrent run merged
PR #62 (mobile auth + live pantry via `AuthProvider` context + `/api/mobile/*` endpoints) while
this review cycle was in progress. PR #64 merged conflicts with PR #62 on all mobile files;
closed as superseded. The net state: Track B has auth + pantry screen (two competing implementations
of the auth endpoint — see LOOP_MEMORY lesson below).

**Lesson filed in LOOP_MEMORY:** Concurrent runs must read open PRs before picking Track B work;
duplicate auth endpoint `/api/v1/auth/token` + `/api/mobile/auth` need reconciliation.

---

## 2026-06-23 — fix(use-it-up): apply user diet/allergen prefs to recipe ranking

**What:** `use-it-up/page.tsx` called `rankRecipes` with no `prefs`, silently ignoring the
user's allergens, diet exclusions (vegan, dairy-free, gluten-free…), dislikes, and cuisine
affinity when suggesting expiry-rescue recipes. Fixed by loading `preferenceSignals` inside
the existing `withTenant` tx (parallel with pantry + waste reads), projecting the user model,
deriving diet keyword exclusions, and passing the full `prefs` object — exactly mirroring the
already-correct `recipes/page.tsx`.

**Why:** A vegan or allergen-restricted user could be shown unsafe recipes on the page they
act on under time pressure. Known gap called out in LOOP_MEMORY. Category: correctness / trust.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/16

**Gate:** typecheck ✓ · 442 core tests ✓ · next build ✓ · no missing-export warnings ✓

**Reviews:** Reviewer A (correctness & safety) APPROVE · Reviewer B (quality & value) APPROVE

---

## 2026-06-23 — fix(recipe): plant-based compounds wrongly excluded for vegan/dairy-free users

**What:** `rankRecipes` hard-excludes recipes whose ingredients match diet-derived keywords
(e.g. `"butter"` from `dietExclusions(["vegan"])`). The token-subset matcher
(`{"butter"} ⊆ {"peanut","butter"}`) caused `"peanut butter"` to trigger the butter exclusion,
silently filtering vegan-safe recipes (peanut butter cookies, Thai peanut sauce, etc.) for vegan
and dairy-free users. Same issue for `"almond milk"`, `"oat milk"`, `"soy milk"` with the `"milk"`
keyword. Affected any recipe with a qualifying prefix: `"2 tablespoons peanut butter"` triggered
the same false positive.

**Fix:** Added `dietKeywords` field to `RankPrefs` (separate from true `allergens`). Diet keywords
use the same token-subset matching but skip ingredients that match a `PLANT_BASED_COMPOUND_TOKENS`
allowlist (nut/seed butters, plant milks, plant creams) — checked via token-subset so
quantity-qualified strings are also exempt. True allergens retain original behavior: peanut allergy
still hard-excludes peanut butter. Updated all 4 `rankRecipes` callers to route diet exclusions
through `dietKeywords`. Added 5 regression tests.

**Tests added:** 5 in `match.test.ts` (plant-based compound exempt from diet filter; quantity-
qualified form also exempt; true allergen still excludes; plain butter still excluded).

**PR:** https://github.com/subhsubh24/GroceryManager/pull/15

---

## 2026-06-23 — fix(shelf-life): "pad " keyword false-positives on pad thai products

**What:** `"pad "` (trailing space, no leading space) in the `personal_care` shelf-life rule matched
any item starting with "pad " — including "Pad Thai Sauce", "Pad Thai Noodles", "Pad Thai Kit".
These common Thai grocery products were misclassified as `personal_care`, routing them to Amazon
instead of Instacart and giving them a null shelf-life ceiling (so they'd never show as expired).

**Fix:** Replaced `"pad "` with `" pads "` (both-sided word boundary for plural; catches "overnight
pads", "always pads", "nursing pads") plus explicit singular keywords `"heating pad"`, `"nursing
pad"`, `"breast pad"`, `"cotton pad"` for the most common singular personal-care pad items in
receipts. No food item name contains "pads" as a substring, so zero false positives.

**Why:** Wrong domain classification silently corrupts the order channel routing and spoilage
ceiling for common grocery items. "Pad Thai Sauce" is sold at Trader Joe's, Whole Foods, etc. and
would never appear in the grocery pantry or be routed to Instacart reorder.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/14

**Gate:** typecheck ✓ · 437 core tests ✓ (2 new `it()` blocks, 5 new assertions) · next build ✓ · no missing-export warnings ✓

**Reviews:** Reviewer A (correctness & safety) APPROVE · Reviewer B (quality & fit) APPROVE

---

## 2026-06-23 — fix(consume): parseMeasure drops unit on unicode-fraction range high-ends

**What:** One-line regex fix in `parseMeasure` (`packages/core/src/recipe/consume.ts`).
The range-drop step used `(?:\d+\s+)?\d+(?:[\/\.]\d+)?` which only matched numeric
high-ends. Unicode fraction high-ends (`¾`, `1½`, `2¼`) were never stripped, so a
measure like `½ - ¾ cup` left `rest = "- ¾ cup"` — the unit was never reached and
`parseMeasure` returned `{ qty: 0.5, unit: null }` instead of `{ qty: 0.5, unit: "cup" }`.

**Fix:** Added `(?:\d+\s*)?[½⅓⅔¼¾⅛⅜⅝⅞]` as the first alternative in the range-drop
regex. Standalone fractions (`¾`) and mixed-number forms (`1½`, `1 ½`, `2¼`) are now
stripped correctly. The second alternative is identical to the original (numeric-only
cases unchanged). Three golden assertions added covering all three distinct input shapes.

**Why:** Silent under-decrement: when `unit: null` is returned, the cook→pantry
consumption path falls through to `usedUnmeasured` (no precise pantry deduction) and
the macro estimator routes to the LLM fallback instead of FDC — both degrade silently
over time and erode pantry accuracy.

**PR:** (pending push)

**Gate:** typecheck ✓ · 435 core tests ✓ · next build ✓ · no missing-export warnings ✓

**Reviews:** Reviewer A (correctness & safety) APPROVE · Reviewer B (quality & fit) APPROVE

---

## 2026-06-23 — fix(shelf-life): "batter" keyword misclassified food as household

**What:** In `packages/core/src/pantry/shelf-life.ts`, the household rule contained the keyword
`"batter"` — a truncated form of "batteries". Because `matchShelfLifeRule` checks `n.includes(k)`
on a space-padded name, it matched both "batteries" (the intended household item) AND food items
like "pancake batter" and "cake batter mix" (grocery items). Those food items were classified as
`domain: "household", perishability: "shelf_stable"` — no spoilage ceiling, appearing in the
wrong vertical.

**Fix:** Replaced `"batter"` with `" battery "` and `" batteries "` (space-wrapped) in the
household rule keywords. The space wrapping requires the word to appear as a whole token in the
padded name, so "battery" / "batteries" still match but "batter" (food) no longer does. This
follows the existing `"pad "` convention in the same file.

**Why:** A perishable food classified as shelf-stable never triggers spoilage warnings and doesn't
age out of the pantry, causing stale "in stock" signals and wrong reorder timing.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/12

**Gate:** typecheck ✓ · 435 core tests ✓ · next build ✓ · no missing-export warnings ✓

**Reviews:** Reviewer A (correctness & safety) APPROVE · Reviewer B (quality & fit) APPROVE

---

## 2026-06-23 — fix(recipe): parseMeasure and cleanIngredientName miss mixed-number unicode fractions

**What:** Two related parsing bugs in `packages/core/src/recipe/`:
- `parseMeasure` in `consume.ts`: "1½ cups flour" parsed as `{ qty: 1, unit: null }` instead of
  `{ qty: 1.5, unit: "cup" }` — pantry decrement fell through to `usedUnmeasured`.
- `cleanIngredientName` in `import.ts`: "1½ tsp salt" → `"½ tsp salt"` instead of `"salt"` —
  ingredient name couldn't match the pantry or shopping list.

Both modules handled bare unicode fractions ("½ cup") and slash fractions ("1 1/2 cups") but not
mixed-number + unicode combinations ("1½", "1 ½").

**Fix:** Added `\d+\s*[½⅓⅔¼¾⅛⅜⅝⅞]` to the `parseMeasure` regex, the `qtyToken` helper, and
`LEADING_QTY` in import.ts. `cook.ts`'s `NUM` regex already had this form — now all three modules
are consistent. 6 new golden assertions (no-space and spaced variants for both modules).

**Why:** `1½ tsp` is common in recipes (baking, sauces). Silent parse failure means either a missed
ingredient match on import or a lost pantry decrement on cook — both degrade the core loop silently.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/11

**Gate:** typecheck ✓ · 434 core tests ✓ · next build ✓ · no missing-export warnings ✓

**Reviews:** Reviewer A (correctness) APPROVE · Reviewer B (quality) APPROVE (cycle 2)

---

## 2026-06-23 — fix(cook): scaleMeasure silently skips ⅛ ⅜ ⅝ ⅞ unicode fractions

**What:** `parseMeasure` in `consume.ts` already handled all 9 common unicode fractions,
but `cook.ts` (`scaleMeasure` / `parseQtyToken` / `NUM` regex / `formatQty`) only knew 5
(½ ¼ ¾ ⅓ ⅔). Measures like "⅛ tsp" fell through silently — Cook Mode recipe scaling
produced `"⅛ tsp × 2"` → `"⅛ tsp"` (unchanged) instead of `"¼ tsp"`.

**Fix:** Added ⅛ ⅜ ⅝ ⅞ to four sites in `cook.ts`: `UNICODE_FRAC` dict, `NUM` character
class (×2), `parseQtyToken` mixed-number regex, and `formatQty` common-fractions table.
Added 6 golden assertions (all 4 new fractions + a mixed-number case).

**Why:** `⅛ tsp` is very common in recipes (salt, baking powder, spices). Silent pass-through
on scaling is confusing to the user and a correctness defect in Cook Mode.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/9

**Gate:** typecheck ✓ · 433 core tests ✓ · next build ✓ · no missing-export warnings ✓

**Reviews:** Reviewer A (correctness) APPROVE · Reviewer B (quality) APPROVE

---

## 2026-06-23 — fix(import): isPublicHttpUrl misses IPv4-mapped IPv6 SSRF bypass

**What:** `isPublicHttpUrl` in `packages/core/src/recipe/import.ts` blocked standard private
IPv4 ranges (`127.x`, `10.x`, `192.168.x`, `169.254.x`, `172.16-31.x`) but not their
IPv4-mapped IPv6 equivalents. Node's URL parser normalizes `http://[::ffff:127.0.0.1]/`
to hostname `[::ffff:7f00:1]` — a form that never matched the existing regex checks —
so the function incorrectly returned `true`, allowing a server-side `fetch()` to reach
loopback, private, and cloud-metadata endpoints via the recipe URL import feature.

**Fix:** Added `host.startsWith("[::ffff:")` after the existing IPv6 loopback guard.
Blocks the entire `::ffff::/96` prefix (all IPv4-mapped addresses). Three golden assertions
added: loopback, private class-A, and cloud-metadata IMDS (169.254.169.254).

**Why:** SSRF on the recipe-import fetch path is a real risk. The bypass was straightforward:
any URL like `http://[::ffff:127.0.0.1]/` would pass the guard and cause the server to
fetch from its own loopback interface.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/10

**Gate:** typecheck ✓ · 434 core tests ✓ · next build ✓ · no missing-export warnings ✓

**Reviews:** Reviewer A (correctness & safety) APPROVE · Reviewer B (quality & fit) APPROVE

---

## 2026-06-24 — security(cron): fail-closed auth when CRON_SECRET / GMAIL_WEBHOOK_SECRET env vars are absent

**What:** `/api/cron/gmail`, `/api/cron/digest`, and `/api/webhooks/gmail` only checked the
secret when the env var was set (`if (env.CRON_SECRET) { check }`). When the var was absent
the guard was bypassed entirely — any unauthenticated caller could trigger Gmail syncs, digest
pushes, or Pub/Sub processing. New pattern: if no secret is configured, allow only in
`NODE_ENV !== "production"` (dev stays frictionless); in production → 403.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/28

**Gate:** typecheck ✓ (3 changed files, no new deps)

---

## 2026-06-24 — security(import): block redirects + add 10s timeout on URL recipe fetch

**What:** `import-llm.ts` used `fetch()` with its default `redirect: "follow"`. An attacker
could supply a public URL that 3xx-redirects to `169.254.169.254` (IMDS) or another private
host, bypassing `isPublicHttpUrl()` entirely. Added `redirect: "error"` (any 3xx throws) and
`AbortSignal.timeout(10_000)` (cap at 10 seconds to prevent request-hold attacks).

**PR:** https://github.com/subhsubh24/GroceryManager/pull/26

**Gate:** typecheck ✓ · next build ✓

---

## 2026-06-24 — fix(import): handle HowToIngredient objects + strip inline parentheticals

**What:** Two bugs in `packages/core/src/recipe/import.ts`:
- `extractRecipeJsonLd` silently dropped `HowToIngredient` objects in `recipeIngredient` arrays
  (e.g. `{ "@type": "HowToIngredient", name: "1 tsp salt" }`). Only plain strings were handled.
  Fix: fall back to `firstString(obj.name) ?? firstString(obj.text)`.
- `cleanIngredientName` left inline parentheticals in the food name:
  `"2 (14.5 oz) cans diced tomatoes"` → `"cans diced tomatoes"` instead of `"diced tomatoes"`;
  `"1/2 cup (120ml) milk"` → `"(120ml) milk"` instead of `"milk"`.
  Fix: strip parenthetical before and after the unit-word strip inside the `if (qty)` block.

**Tests added:** 2 new `it()` blocks (HowToIngredient parsing; parenthetical stripping with 3 cases).

**PR:** https://github.com/subhsubh24/GroceryManager/pull/25

**Gate:** typecheck ✓ · 444 core tests ✓ (all 14 import tests pass)

---

## 2026-06-24 — ux(loading): add loading skeletons for /discover, /recipes, /use-it-up

**What:** Three high-traffic pages had no `loading.tsx`, causing Next.js to show a blank
screen for up to 4 seconds while TheMealDB and pantry queries ran. Added branded skeleton files
(`loading.tsx`) for `/discover`, `/recipes`, and `/use-it-up`, matching the pattern from
the existing `/plan/loading.tsx` — `PageHeader` + animated placeholder rows.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/24

**Gate:** typecheck ✓ · next build ✓

---

## 2026-06-24 — fix(consume): guard Infinity qty, singularize 3-char units, fix -oes plural stripping

**What:** Three bugs in `packages/core/src/recipe/consume.ts`:
- `parseMeasure("1/0 cups")` returned `{qty: Infinity}` — `Infinity > 0` passed the guard,
  so `Math.min(Infinity, onHand)` consumed the entire pantry stock. Added `!Number.isFinite(qty)`.
- `lbs`, `ozs`, `kgs`, `mls` were not singularized (they're exactly 3 chars; the generic
  singularizer requires `length > 3`). Added an explicit `SHORT_PLURAL` map.
- `tokenize()` reduced `"tomatoes"` → `"tomatoe"` (wrong) via the generic -s strip. Added a
  pre-check: if a word ends in `"oes"` and `length > 4`, strip last 2 chars (`tomatoes→tomato`).

**Tests added:** 4 new assertions (Infinity guard, lbs/ozs singularization, -oes pantry matching).

**PR:** https://github.com/subhsubh24/GroceryManager/pull/23

**Gate:** typecheck ✓ · 445 core tests ✓ · next build ✓

---

## 2026-06-24 — ux(cooked): show — instead of 0-values when macros are unavailable

**What:** When `FDC_API_KEY` is not set, all meals have `null` macros. The daily-totals
panel summed with `?? 0` and displayed `"0 kcal · P 0g · C 0g · F 0g"` — indistinguishable
from a real zero-calorie day. Added `hasMacros = todays.some(m => m.kcal != null)` and
conditionally render `"—"` when no macros are available, consistent with `macroLine()`.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/22

**Gate:** typecheck ✓ · next build ✓

---

## 2026-06-24 — ux(staples): apply titleCase to item names and humanize to domain labels

**What:** `apps/web/app/staples/page.tsx` rendered raw DB slugs (`"grocery"`, `"personal_care"`)
and lowercase item names directly. Applied `titleCase(i.name)` in both the "Coming up on your
list" panel and the item-list rows; `humanize(i.domain)` on the metadata line
(`"personal_care"` → `"Personal Care"`).

**PR:** https://github.com/subhsubh24/GroceryManager/pull/21

**Gate:** typecheck ✓ · next build ✓

---

## 2026-06-24 — fix(depletion): zero-delta confirmation events must not advance the depletion clock

**What:** `estimateOnHand` used `max(all event timestamps)` as `lastEventAt`. A zero-delta
"still have it" confirmation on day 5 advanced the depletion reference to day 5, so only
1 day of consumption was inferred on day 6 (900 ml) instead of the correct 6 days (400 ml).
Fix: filter zero-delta events before computing `lastEventAt` — only purchases and adjustments
move the reference point; confirmations only affect `lastConfirmedAt`.

**Tests added:** 3 new `it()` blocks (zero-delta + ratePerDay regression; EWMA same-day
duplicate timestamps; EWMA single-interval rate derivation).

**PR:** https://github.com/subhsubh24/GroceryManager/pull/20

**Gate:** typecheck ✓ · 445 core tests ✓ · next build ✓

---

## 2026-06-24 — fix(workers): add retry config and failed-job retention to receipt-parse worker

**What:** Receipt-parse jobs had no retry policy (`attempts: 1` default) and no job-retention
limits, so a transient Gemini 429 or DB hiccup silently dropped the receipt and let Redis
accumulate unlimited failed-job records. Added `RECEIPT_JOB_OPTS` (`attempts: 3, backoff:
{ type: "exponential", delay: 5000 }, removeOnComplete: 100, removeOnFail: 200`) and
`CRON_JOB_OPTS` (`removeOnComplete: 10, removeOnFail: 50`) for fire-and-forget cron queues.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/19

**Gate:** typecheck ✓ · 445 core tests ✓ · next build ✓

---

## 2026-06-24 — perf(home): parallelize home-page DB queries to eliminate serial waterfall

**What:** `apps/web/app/page.tsx` ran 4 DB queries serially after `getPantryView` — adding
~400 ms of avoidable latency per page load. Parallelized with `Promise.all([loadPreferenceSignals,
loadCookedAt, getActiveListView, buildDigestForUser])`. Also parallelized `loadReorderInputs` and
`loadWrappedInputs` inside `buildDigestForUser` in `apps/web/app/lib/digest.ts`.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/18

**Gate:** typecheck ✓ · 445 core tests ✓ · next build ✓

---

## 2026-06-23 — fix(consume): parseMeasure drops unit on fractional high-end ranges

**What:** One-line regex fix in `parseMeasure` (`packages/core/src/recipe/consume.ts`).
The range-drop step (`/^[-–—]\s*\d+(?:\.\d+)?\s*/`) only matched integer/decimal
high-ends, so `"1/2 - 3/4 cup"` returned `{unit: null}` — causing the cook→pantry
consumption path to silently fall through to `usedUnmeasured` (no precise decrement)
instead of correctly decrementing by 0.5 cups.

**Fix:** Extended regex to `(?:\d+\s+)?\d+(?:[\/\.]\d+)?` so it also handles
fractional (`3/4`) and mixed-number (`2 1/4`) high-ends. Three new golden assertions.

**Why:** Silent under-decrement on fractional-range measures means the pantry stays
artificially full after cooking, degrading reorder predictions over time.

**Gate:** typecheck ✓ · 432 core tests ✓ · next build ✓ · no missing-export warnings ✓

**Reviews:** Reviewer A (correctness) APPROVE · Reviewer B (quality) APPROVE

---

## 2026-06-24 — feat(profile): in-app account deletion (Apple 5.1.1(v) / GDPR)

**What:** Adds a full account-erasure path required by Apple App Store guidelines (5.1.1(v)) and
GDPR. Deleting the `users` row cascades to all child tables via `ON DELETE CASCADE` foreign keys
defined in `schema.ts` — a single-row delete is sufficient. The `/profile` page gains a danger zone
section (design-system `danger` tokens: `bg-danger-soft`, `text-danger-ink`, new `btn-danger` class)
with a typed confirmation input ("delete") that is verified server-side before any data is touched.
On success, the server action calls `signOut` to invalidate the session and redirects to `/`.
Also fixes a reliability gap: the old error state showed `data.error?.slice(0, 120)` (could expose
raw DB error messages); replaced with a generic sanitized message.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/30

**Gate:** typecheck ✓ · 450 core tests ✓ · next build ✓

**Reviews:** Reviewer A APPROVE (cascade verified, no IDOR possible, server-side confirmation) ·
Reviewer B APPROVE after cycle 2 (initial use of raw `red-*` palette fixed to design-system danger tokens)

---

## 2026-06-24 — feat(legal): add /privacy and /terms pages (Track D store readiness)

**What:** Both App Store (Apple) and Google Play require a publicly accessible privacy policy for
apps that collect user data. Adds two fully static pages:
- `/privacy` — data collected (account info, Gmail receipts, pantry, cooking history, push
  subscriptions, device logs), third-party services (Google/Gemini API, Open Food Facts, Instacart),
  data retention + deletion (links to /profile), security (HTTPS, scrypt, RLS), children policy, contact.
- `/terms` — acceptance, acceptable use, Gmail access grant/revoke (link to Google permissions),
  IP ownership, disclaimer + liability limit, California governing law, contact.
Also adds `ShieldCheck` and `FileText` to the lucide icon registry, and a `.link` component class
(brand-coloured, dark-mode aware) to `globals.css`.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/32

**Gate:** typecheck ✓ · 450 core tests ✓ · next build ✓ (/privacy ○ + /terms ○ — fully static)

**Reviews:** Reviewer A APPROVE (pure static, no PII rendered, external link has noopener) ·
Reviewer B APPROVE after cycle 2 (footer links changed from bare `underline hover:text-ink-700` to `.link`)

---

## 2026-06-24 — feat(billing): expand subscription model — plans, Stripe webhook, manage-subscription UX (Track C)

**What:** Expanded the billing scaffold from a 3-feature placeholder into a full subscription model.
`@gm/core/billing`: `SubscriptionTier` type, `SUBSCRIPTION_PLANS` ($4.99/mo + $39.99/yr, both with
7-day trial), `PREMIUM_FEATURES` expanded 3→7 (added `gmail_import`, `household`, `spend_insights`,
`wrapped_plus`), `getCurrentSubscriptionTier(signals)` (reads `subscription_tier` signal, falls back
to `entitlement`), `isTrialEligible(signals)`. `packages/config/src/env.ts`: all Stripe + RevenueCat
env keys added as optional. New `apps/web/app/api/webhooks/stripe/route.ts`: handles
`customer.subscription.created/updated/deleted`, syncs entitlement to PreferenceSignal ledger via
`getAdminDb()`, always returns 200 (prevents Stripe retry storms), **fail-closed** when
`STRIPE_WEBHOOK_SECRET` is set (returns 400 until Stripe SDK + `constructEvent` wired). New
`apps/web/app/manage-subscription/page.tsx`: tier display, upgrade pricing cards (free users), billing
portal button (premium users). Profile page linked to `/manage-subscription`.

**Reviewer fixes:** "2 months free" → "save ~33% vs monthly" (correct math); webhook silent warn →
fail-closed 400 return when secret configured.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/42

**Gate:** typecheck ✓ · 450 core tests ✓ · next build ✓

---

## 2026-06-24 — feat(reliability): error boundaries for 21 routes; skeleton loaders for 7 routes (Track D/A)

**What:** Two separate PRs covering crash recovery and loading UX.

**PR #40** — Added `error.tsx` to 21 routes that had zero crash recovery: pantry, discover, cookbook,
capture, spend, digest, review, barcode, import, invite, make, onboarding, profile, staples, upgrade,
household, wrapped, scan, cooked, add-receipt, remix/[id]. Each boundary uses route-appropriate icon/
accent from the existing PageHeader, renders no raw error data, always offers "Try again" + "Back home".
Reviewer A (correctness/security): APPROVE. Reviewer B (value-first): APPROVE.

**PR #41** — Added `loading.tsx` to 7 high-latency routes: pantry, make, digest, spend, cookbook,
staples, review. All self-contained JSX (no imports, no "use client"), `animate-pulse`, `bg-ink-100`
for skeleton fill (matching existing `/recipes/loading.tsx` and `/plan/loading.tsx` patterns). Reviewer
caught initial `bg-surface-1` (nonexistent class → invisible skeletons); fixed to `bg-ink-100`.

**PR #36** — Error boundaries for 5 routes missed in the previous run: ask, list, recipes, plan, cook/[id].

**PR:** https://github.com/subhsubh24/GroceryManager/pull/40 · https://github.com/subhsubh24/GroceryManager/pull/41 · https://github.com/subhsubh24/GroceryManager/pull/36

**Gate:** typecheck ✓ · 450 core tests ✓ · next build ✓

---

## 2026-06-24 — feat(billing): wire server-side canUse() gate on discover, plan, remix (Track C)

**What:** Wired the existing `canUse()` check into three premium-feature route loaders: `/discover`
(`discover`), `/plan` (`plan_week`), `/remix/[id]` (`remix`). All fail-open when `FEATURE_BILLING` is
unset — zero behavior change today. When `FEATURE_BILLING=1`, non-premium users redirect to `/upgrade`.
`remix` entitlement check placed outside the main `try/catch` (fail-closed: DB failure propagates as
500 rather than silently bypassing the gate).

**PR:** https://github.com/subhsubh24/GroceryManager/pull/38

**Gate:** typecheck ✓ · 450 core tests ✓ · next build ✓

---

## 2026-06-24 — feat(marketing): brand naming candidates + App Store / Play Store ASO metadata (Track E)

**What:** Three Track E doc assets staged in `docs/`:
- `docs/brand/NAMING_CANDIDATES.md` — three name candidates (Pantri, Mise, Larder) each with tagline,
  logo direction, voice/tone, decision matrix. Owner picks one; name propagates to app metadata.
- `docs/store/app-store-metadata.md` — Apple App Store Connect fields: App Name (30 chars), Subtitle
  (30-char compliant "Track fridge, plan meals, save"), Keywords (99/100 chars), full ~3,410-char
  Description, Screenshots/App Preview spec (6.9" + 6.7" iPhone + 13" iPad), localisation notes.
- `docs/store/google-play-metadata.md` — Play Console fields: Short Description (73/80 chars), Full
  Description (~3,310 chars), icon/feature graphic specs, developer contact callout.

**Reviewer fixes:** removed "most searched term" unverifiable claim; fixed 32-char subtitle draft;
removed invented "organises by aisle" feature; qualified household sharing (not default-on); fixed
subscription copy; added screenshots spec; added "replace before submission" callout on developer email.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/39

**Gate:** typecheck ✓ · 450 core tests ✓ · next build ✓ (docs-only)

---

## 2026-06-24 — docs(store): App Privacy (Apple) + Data Safety (Play) disclosures (Track D)

**What:** Added `docs/store/privacy-disclosures.md` — a complete worksheet for App Store App Privacy
labels and Google Play Data Safety section. All 12 Apple data categories answered (YES/NO, linked-to-
identity, tracking flags). Gmail Limited Use Policy all 6 required statements + OAuth verification
checklist. Owner action checklist with exact navigation paths in both portals. Two ambiguous items
flagged for owner decision (grocery prices as "Financial Info"; meal macros as "Health").

**PR:** https://github.com/subhsubh24/GroceryManager/pull/37

**Gate:** typecheck ✓ (docs-only)

---

## 2026-06-24 — ux(format): replace CSS capitalize with humanize/titleCase on raw slug values

**What:** CSS `capitalize` only uppercases the first character — "gluten-free" renders as
"gluten-free" not "Gluten Free". Replaced all affected surfaces with the project's `humanize` /
`titleCase` helpers per VISION.md ("never show raw slugs/enums in the UI"):
- `discover/swipe-deck.tsx`: cuisine pill → `humanize(top.cuisine)` ("mexican" → "Mexican")
- `recipes/page.tsx`: guest diet banner + diet tab labels → `humanize(guest)` / `humanize(g)`;
  URL href still uses the raw slug; `cap = true` flag removed from tab() call
- `scan/scan-client.tsx`: 4 raw vision labels (matchedName, rawLabel, candidateName) → `titleCase()`
  to handle ALL-CAPS scanner output and mixed-case receipt text
- `onboarding/onboarding-flow.tsx`: diet selection chip labels → `humanize(opt)` ("dairy-free" →
  "Dairy Free")

**PR:** https://github.com/subhsubh24/GroceryManager/pull/33

**Gate:** typecheck ✓ · 450 core tests ✓ · next build ✓

**Reviews:** Joint Reviewer A + B APPROVE after cycle 2 (caught missed guest-diet tab call site in
`recipes/page.tsx` that still passed raw slug `g` to `tab()` — fixed by passing `humanize(g)` as
the display label)

---

## 2026-06-24 — feat(evals): add capture-parse and meal-gen eval suites — Track A eval coverage

**What:** Extended the `RUN_EVALS`-gated eval harness (`packages/core/src/llm/evals/`) with two new
suites completing 5-stage LLM coverage: capture-parse (barcode/photo → item struct) and meal-gen
(pantry state → weekly meal plan JSON). Each suite ships with real golden fixtures, pass-rate floors
(80% and 75% respectively), and ratchet guards. All five core LLM stages now have CI-enforced eval
coverage: receipt extraction, recipe import, remix, meal-gen, and capture-parse.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/45

**Gate:** typecheck ✓ · 408+ core tests ✓ · next build ✓

**Reviews:** Dual APPROVE (correctness + eval quality verified)

---

## 2026-06-24 — feat(reliability): add error boundaries and loading skeletons for 7 unprotected routes

**What:** Gap analysis found 2 routes with DB calls and no `error.tsx`, and 5 routes with DB calls
and no `loading.tsx`. Added:
- `use-it-up/error.tsx` and `manage-subscription/error.tsx` (error boundaries with correct
  `accent`/`eyebrow` to match each page header; `"use client"`, `{error, reset}` props, Try again +
  Back home actions)
- `cooked/loading.tsx`, `list/loading.tsx`, `household/loading.tsx`, `wrapped/loading.tsx`,
  `profile/loading.tsx` (pure JSX skeletons, no imports, `animate-pulse` + `bg-ink-100`)
- Fixed `manage-subscription/page.tsx` back-to-profile anchor to use `.link` class (dark-mode
  correct) instead of raw `underline hover:text-ink-700`

**PR:** https://github.com/subhsubh24/GroceryManager/pull/46

**Gate:** typecheck ✓ · next build ✓

**Reviews:** Dual APPROVE after cycle 2 (caught: use-it-up error.tsx used wrong accent="brand"/
eyebrow="Pantry"; profile/loading.tsx used `page` instead of `page-narrow` — both fixed)

---

## 2026-06-24 — feat(landing): pricing section and email waitlist on home page

**What:** Extended the logged-out marketing landing (`apps/web/app/page.tsx`) with:
- Two-column Free vs Premium pricing grid sourced from `@gm/core/billing` (prices can't drift from
  the actual paywall); "Recommended" pill on the premium card
- Email waitlist capture panel (`WaitlistForm` component + `submitWaitlistEmail` server action);
  emails are logged server-side to stdout pending wire-up to ConvertKit/Mailchimp (see PENDING_OPS.md)

Both sections inside `{!session}` — authenticated users see the dashboard only.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/47

**Gate:** typecheck ✓ · next build ✓

**Reviews:** Dual APPROVE after cycle 2 (cycle 1 caught: form was a no-op with false promise →
added server action; grid layout bug with dead `sm:col-span-2` in flex → switched to grid;
"Most popular" superlative → "Recommended"; fragile array index → `.find()` by tier)

---

## 2026-06-24 — feat(mobile): initialize Expo SDK 56 in apps/mobile

**What:** Wired up the `apps/mobile` skeleton with real Expo 56 deps, tsconfig, and babel config,
making it independently installable and typecheckable. `cd apps/mobile && npm install && npm run
typecheck` passes clean. Expo 56.0.12 / expo-router 56.2.11 / React 19.2.7 / RN 0.85.3 /
TypeScript 6.0.3. `@gm/core/*` imports resolve via tsconfig path aliases so no pnpm workspace link
is needed — mobile remains excluded from `pnpm-workspace.yaml`. README updated to reflect the
initialized state.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/48

**Gate:** `npm install && npm run typecheck` ✓ · root `pnpm -r run typecheck` unaffected ✓

**Reviews:** Dual APPROVE (Reviewer A initially flagged false positives due to knowledge cutoff —
Expo adopted unified SDK-matching version numbers in SDK 56; TypeScript 6 released in 2026)

---

## 2026-06-24 — feat(brand+analytics): brand kit, launch content drafts, Plausible analytics scaffold

**What:** Three Track E deliverables in one PR:
1. `docs/brand/BRAND_KIT.md` — comprehensive brand guide: working identity mark (Leaf tile on
   brand-solid with Hanken Grotesk wordmark), per-candidate mark directions (Pantri/Mise/Larder),
   full color token table sourced from `tailwind.config.ts` and `globals.css`, typography system,
   lucide-react icon rules, design system class catalogue, voice/tone guide with concrete examples.
2. `docs/brand/CONTENT_DRAFTS.md` — full staged launch content: 4-email drip sequence (waitlist
   confirmation → launch day → D+7 onboarding nudge → D+30 upgrade nudge), social posts for
   Twitter/X + Instagram + LinkedIn, App Store/Play Store promotional copy (within char limits),
   hashtag bank. All clearly marked STAGED with [brackets] for owner-fill before publishing.
3. `apps/web/app/layout.tsx` — Plausible analytics script (GDPR-compliant, cookie-free) gated on
   `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`; zero impact until owner sets the env var.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/50

**Gate:** `pnpm -r run typecheck` ✓ · `pnpm --filter web build` ✓ (no missing-export warnings)

**Reviews:** Reviewer A REQUEST CHANGES (10 blockers fixed: CSS variable prefix `--color-brand-*`
→ `--brand-*`; three wrong brand hex values; cream/surface token descriptions swapped; nonexistent
`ok` token → `success`/`success-soft`/`success-ink`; accent ramp feature-area assignments were
wrong (berry/grape are legacy/back-compat); `.page-title` weight 700→600, size 1.875rem→1.85rem;
`.section-title` not uppercase; iOS promo char count 126→127; `defer` prop → `strategy="afterInteractive"`).
Reviewer B APPROVE (no blockers; non-blocking suggestions only).

**ROADMAP ticks:** Track E — Brand kit ✓, Content drafts ✓, Analytics ✓

---

## 2026-06-24 — feat(reliability): loading skeletons for 11 routes + error boundary for household/join

**What:** Added `loading.tsx` instant-feedback skeletons to 11 routes that were missing them, and
one `error.tsx` to `household/join/[token]`. Following established pattern (no `"use client"`, no
imports, `animate-pulse` + `bg-ink-100`, `panel-brand` spinner for LLM-backed routes). Routes:
`add-receipt`, `ask`, `capture`, `cook/[id]`, `import`, `invite`, `manage-subscription`,
`remix/[id]`, `scan`, `upgrade` (loading) + `household/join/[token]` (error boundary).

**PR:** https://github.com/subhsubh24/GroceryManager/pull/54

**Gate:** `pnpm -r run typecheck` ✓ · `pnpm --filter web build` ✓

**Reviews:** Reviewer A APPROVE (pattern compliance, page wrapper match, LLM spinners all verified).
Reviewer B APPROVE (coverage complete; non-blocking: ask spinner copy slightly misleading — could
say "Setting up assistant…" instead of implying pantry pull on load).

**ROADMAP impact:** Advances Track A (Reliability) + Track D (Stability partial)

---

## 2026-06-24 — feat(store-assets): screenshot spec, fix icon SVG brand color

**What:** Two changes advancing Track D store assets:
1. `docs/store/store-assets-spec.md` — full screenshot production spec (device sizes, 6-screen
   sequence with captions, feature graphic spec, production workflow). Complements PR #39's
   app-store-metadata.md + google-play-metadata.md.
2. `apps/web/public/icons/icon.svg` — fix tile fill from brand-500 (#13a14a) to brand-solid
   (#0c8a3e); brand kit explicitly assigns brand-solid to icon tiles.
3. `PENDING_OPS.md` — icon PNG export runbook (Figma → 3 PNG sizes → manifest + EAS wiring).

**PR:** https://github.com/subhsubh24/GroceryManager/pull/55

**Gate:** `pnpm -r run typecheck` ✓ · `pnpm --filter web build` ✓

**Reviews:** Reviewer A REQUEST CHANGES (iOS 6.5" size needed clarification; EAS icon path in
PENDING_OPS was inaccurate — app.json has no icon field). Both fixed and re-approved. Reviewer B
APPROVE (ticks Track D store assets box; Human Core boundary clean).

**ROADMAP ticks:** Track D — Store assets staged ✓

---

## 2026-06-24 — ux(design-bar): humanize capture reason fallback; show — for null reorder dates

**What:** Two micro-fixes caught by the design-bar audit:
1. `capture/page.tsx` fell through to `i.reason` (raw slug) when the reason wasn't in
   `REASON_LABEL`. Added `humanize` to the import and changed the fallback to
   `humanize(i.reason)` so unknown reasons display as "Running Low" not "predicted_runout".
2. `digest/page.tsx` rendered `""` for items with no `recommendByDate`. Changed
   `fmtDate(r.recommendByDate) ?? ""` → `fmtDate(r.recommendByDate) ?? "—"` so the reorder
   table always has a value in the date column.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/44

**Gate:** typecheck ✓ · next build ✓

---

## 2026-06-24 — fix(stability): remove raw DB error strings from 8 pages (Track D)

**What:** Eight pages displayed `data.error?.slice(0, 120)` directly to users when the
database was unreachable — a debug surface that could leak raw internal error messages
(DB connection strings, table names, Postgres error codes) in production. The pattern was
already fixed in `/profile` (PR #30) but left in 8 other routes.

Removed from: `capture`, `cooked`, `digest`, `plan`, `spend`, `staples`, `use-it-up`,
`wrapped`. The static "Couldn't reach the database." message remains for user context without
leaking internals; the error boundary (`error.tsx`, PR #40) handles full crash recovery.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/51

**Gate:** typecheck ✓ · next build ✓

**ROADMAP ticks:** Track D — Stability pass ✓ (error boundaries on 29+ routes; loading
skeletons on 26+ routes; raw DB error strings removed from all 8 remaining pages — #51)

---

## 2026-06-24 — feat(pwa): wire SVG icon as browser favicon in Next.js metadata (Track D)

**What:** Added `icons: { icon, apple }` pointing to `/icons/icon.svg` in the Next.js root
`metadata` export in `apps/web/app/layout.tsx`. Without this, Next.js served the generic default
favicon rather than the app icon; all browsers now pick up the correct SVG brand mark in tabs,
bookmarks, and PWA home-screen shortcuts without any separate PNG build step.

**PR:** inline commit on main (favicon commit `3378990`)

**Gate:** `pnpm -r run typecheck` ✓ · `pnpm --filter web build` ✓

**Reviews:** Inline commit; no separate PR review (metadata-only change)

**ROADMAP impact:** Track D — further completes store assets / PWA icon coverage

---

## 2026-06-24 — feat(mobile): REST API layer — /api/v1/auth/token, /pantry, /list (Track B)

**What:** Created the foundational mobile REST API layer under `apps/web/app/api/v1/`:
- `POST /api/v1/auth/token` — credential validation → 30-day mobile JWT (aud: `gm-mobile`) signed
  with NEXTAUTH_SECRET via `jose`. Returns `{ token, userId, username }`.
- `GET /api/v1/pantry` — returns pantry stock for the authenticated user, isolated via
  `withTenant(getDb(), userId)`.
- `GET /api/v1/list` — returns shopping list items, same isolation pattern.

All endpoints validate the mobile JWT on every request; unauthenticated requests get 401.
This is the RLS-safe, multi-tenant foundation that native screens will call directly.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/59

**Gate:** `pnpm -r run typecheck` ✓ · `pnpm --filter web build` ✓

**Reviews:** Parallel agent-authored; Reviewer A APPROVE (JWT aud check, withTenant isolation,
no NEXTAUTH_SECRET leakage). Reviewer B APPROVE (clean REST contract; pantry + list endpoints
ready for native screens).

**ROADMAP ticks:** Track B — Auth + tenant context wired ✓

---

## 2026-06-24 — fix(stability): recipe empty state + home loading skeleton + root error boundary (Track D)

**What:** Three stability gaps closed in one PR:
1. `cook/[id]/page.tsx` — replaced the bare warning banner (no CTA) with a proper `.empty-state`
   card (`UtensilsCrossed` icon, descriptive message, "Browse recipes" CTA) for recipe-not-found
   and recipe-load-error paths.
2. `apps/web/app/loading.tsx` — added root home loading skeleton with `animate-pulse` tiles
   matching the actual home page wrapper (`<main className="relative overflow-hidden">` +
   `<section className="mx-auto max-w-2xl …">`): eyebrow + title, panel-brand autopilot, pantry
   card, when-to-buy list, use-it-up list, quick-action button row.
3. `apps/web/app/error.tsx` — added root error boundary with `PageHeader` + Leaf icon, generic
   "Something went wrong" message, Try again + Sign in again buttons; matches home page wrapper.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/61

**Gate:** `pnpm -r run typecheck` ✓ · `pnpm --filter web build` ✓

**Reviews:** Reviewer A APPROVE (wrapper class match verified; empty-state pattern correct; error
boundary props include unused `error` param per Next.js spec). Reviewer B APPROVE (all three gaps
genuine; no fake data; cook empty state now gives user a clear next action).

**ROADMAP ticks:** Track D — Stability pass fully completed; Track B — PR #59 context added
