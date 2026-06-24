# Improvement Log

Dated entries from each autonomous loop run.

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
