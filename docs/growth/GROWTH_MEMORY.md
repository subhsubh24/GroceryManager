# GROWTH MEMORY — GroceryManager

The Growth Agent's **cross-run memory**. The agent starts every run COLD (this git repo is its only
memory), so this file is how it gets smarter over time instead of repeating dead ends. Read it FIRST
each run, then append to it.

This is the narrative companion to the machine-readable `GROWTH_STATUS` block in
[GROWTH_STATUS.md](./GROWTH_STATUS.md): `GROWTH_STATUS` holds the current numbers; this file holds the
*why* — what was tried, what worked, what didn't, and the distilled lessons carried forward.

## How to maintain it (Growth Agent)
- **Read the DURABLE LESSONS + the last few RUN LOG entries before doing anything.** Never re-run a
  strategy already recorded as a dead end without a specific new reason.
- **Append one RUN LOG entry per run** (dated). Keep it short and honest: what you shipped/sharpened,
  the hypothesis, the REAL result if measurable, and the decision (keep / kill / iterate).
- **Promote repeated findings into DURABLE LESSONS** — the compounding layer. A lesson must be
  grounded in real data or research, never a guess.
- **Record operational failures too** (a gate flake, a stale asset, a blocked owner action that
  recurred) so the loop stops tripping on them.
- Real data only. No invented metrics, no fabricated wins. A quiet, honest entry is a good entry.

## DURABLE LESSONS (the compounding layer — distilled, carried forward)
_None yet — the first run established the baseline. Promote a finding here once confirmed across ≥2 runs._

### LESSON-0 (established 2026-06-29): Receipt-auto-fill is the real differentiator
Competitor research (Paprika, Mealime, AnyList, KitchenPal, SuperCook, Foodat) confirms that manual
entry or barcode scanning is the dominant pantry update method across all established apps. Automatic
receipt-based pantry building (Gmail + photo) combined with depletion tracking is a genuine gap — not
just a marketing claim. Use this in every positioning surface. Do NOT invent user counts or ratings to
support it; the gap speaks for itself.

## RUN LOG (newest first)

### 2026-07-05 (run 9) — pre_launch, unchanged infra; NEW GTM_STANDARD §13 two-gate marketing system read + tracked
- **Mode**: Still the run-8 state (channels_connected: [email], awaiting_connect: false, site_gate_up: true),
  RE-VERIFIED rather than assumed. No new owner movement.
- **Did**:
  - Read GROWTH_STATUS, GROWTH_MEMORY, PENDING_OPS, GTM_SCORECARD (still stale as_of 2026-07-01 — nothing
    new to act on; all dims A/A+ per that grade, nothing ship-critical below A), ANALYSIS_PLAYBOOK, OUTREACH,
    GTM_STANDARD, FACTORY_STANDARD, BUSINESS_CASE. `git log` since run 8's merge showed 3 new commits — none
    touching product/infra code: #440 (independent Quality Auditor re-audit, overall A HELD, ship_gate_met
    unchanged true, as_of bumped 2026-07-03 -> 2026-07-05), #441 (GTM_STANDARD.md gained new §10 language on
    demand-driven auto-steer + a Reddit/X connected-data-source path, AND a brand-new §13 "two owner approval
    gates" marketing-launch system), #443 (a ROADMAP.md item adding a future marketing media-gen adapter —
    build work, not yet built).
  - **Re-probed real state directly** (FACTORY_STANDARD §28 discipline — never infer from git alone):
    `CRON_SECRET` was present in this run's env again; `GET /api/growth/snapshot` with it returned a fresh
    HTTP 200 with a payload BYTE-IDENTICAL in substance to run 8's — all 4 sources (waitlist/analytics/
    billing/email) still genuinely connected, funnel still honestly all `0`/`null`, the same 3 H10
    experiments still `status: running` with null results. Direct curl against the live URL reproduced the
    identical site-gate split (home/blog 200, `/signup`+`/admin/waitlist` 401). Re-read `PENDING_OPS.md` in
    full: `eas-build-submit-go-live`, `connect-revenuecat-iap`, `spend-caps`, `turnstile-keys`,
    `rotate-envl-secrets` are ALL still `status: open`, byte-identical to run 8 — zero Human-Core movement
    since run 8 (which itself was only ~1 day prior).
  - **Read GTM_STANDARD §13 in full** (new this run) and reconciled it against real evidence rather than
    assuming: it introduces a two-gate approval system (GATE 1 = start waitlist outreach, GATE 2 = launch),
    each requiring an explicit owner approval on top of the existing readiness gate (§6). GATE 1's
    precondition (b) — "a FULL computer-use E2E sweep GREEN (`VALIDATOR_STATUS.md`)" — does NOT hold: that
    file does not exist anywhere in the repo (confirmed via Glob), and `ROADMAP.md:408` still lists the §29
    computer-use validator as an UNCHECKED build item (epic #413), even though its owner-side precondition
    (BROWSERBASE_API_KEY/PROJECT_ID) was already proven live back on 2026-07-04. So GATE 1 is honestly
    `not_ready` this run — 2 of 3 preconditions hold (`ship_gate_met`, shipped+reviewed waitlist/launch
    assets) but the sweep has never run. **Added a `marketing` block to GROWTH_STATUS** (first run reflecting
    this dashboard schema requirement) recording exactly this: `stage: prepare`, `gate_1.status: not_ready`,
    the named blocking precondition, and `kill_switch: not_present` (confirmed via Glob that neither
    `docs/growth/MARKETING_HOLD` nor `MARKETING_APPROVED` exists yet, as expected pre-approval). Did NOT
    propose GATE 1 to the owner — §13 requires ALL THREE preconditions, none self-certified, and only 2 of 3
    hold. Also noted the §29 sweep gap in `next_actions` as work for the PRODUCT loop (which reads
    GROWTH_STATUS as data per FACTORY_STANDARD §11) — it's un-built product-factory work, not an owner
    blocker, so it correctly does NOT go in `owner_blockers` or PENDING_OPS `OWNER_ACTIONS`.
  - **Demand-signal (§10)**: closed the one open thread from run 7's next_actions — retried "Out of Milk" on
    grand-screen.com with a targeted search (`site:grand-screen.com out of milk grocery shopping list
    reviews`) instead of a guessed slug. The aggregator's real indexed app list came back (AnyList, Our
    Groceries, My Pantry Tracker, My H-E-B, AppSales) with no Out of Milk page anywhere — a genuine negative
    result, not a URL-slug mistake. Closed as a dead end; no new citable theme found this run (existing
    3-theme synthesis from runs 3/6/7 stands unchanged).
  - **Outreach (§3b)**: OUTREACH.md's target-type categories remain fully searched (runs 2-7) with zero
    qualifying targets, and no new reason surfaced this run. Zero outreach drafted — also moot this run since
    GATE 1 (which would gate any outbound-adjacent action per the newly-read §13) is not open anyway.
  - Did NOT touch ROADMAP/VISION/BUSINESS_CASE — no new causal, significant, revenue-linked data this run;
    the `marketing` block addition is a living-artifact schema update reflecting the standard's own newest
    section, not a steer.
  - Ran an independent reviewer subagent (fresh context, adversarial) against this run's full diff before
    committing — see its verdict recorded below once returned.
- **Hypothesis**: none new on the funnel (still no real traffic). This run's work is (a) an honest
  re-verification that infra state is unchanged, (b) reading and correctly operationalizing a brand-new
  standard section without over-claiming readiness, (c) closing one demand-signal dead end.
- **Result**: Infra state confirmed unchanged via fresh round-trip evidence (not assumed). New `marketing`
  gate-tracking block shipped to the dashboard, honestly reporting `not_ready`. Funnel/PMF still `0`/`null`.
- **Decision**: Ship the GROWTH_STATUS/GROWTH_MEMORY/PENDING_OPS updates (reviewer-cleared); zero outreach
  (correct); no ROADMAP/VISION/BUSINESS_CASE steer; no GATE 1/2 proposal (preconditions not fully met).
- **Operational note**: the standard itself can change between runs (this is the first time GTM_STANDARD
  gained a whole new governance section, §13, since this routine started) — the right response was to READ
  it fully, check its preconditions against REAL evidence (not assume readiness because the mission text
  sounded eager to launch), and honestly report `not_ready` rather than proposing a gate the evidence doesn't
  support. Worth remembering for future standard updates: treat a new section as a new set of claims to
  VERIFY, not a new default to assume.

### 2026-07-04 (later cycle, run 8) — pre_launch, awaiting_connect: FALSE, EXECUTE-eligible (MAJOR: 3 channels confirmed connected via real round-trip)
- **Mode**: The 8-run circuit breaker (ADMIN_EMAIL / email provider / PLAUSIBLE_API_KEY unmoved since run 5)
  is RESOLVED — but only partially, and honestly bounded. `CRON_SECRET` was present in this run's
  environment for the FIRST time. Called `GET /api/growth/snapshot` with `Authorization: Bearer
  $CRON_SECRET` against the live deployed URL and got a real HTTP 200 (every prior run got 403 with no
  secret to send). The payload is real, DB/API-round-trip-backed evidence, not a self-report:
  - **analytics: connected** — `fetchPlausibleVisitors7d` actually called the Plausible Stats API and
    got a 200 back with `visitors_7d: 0` (real, not a key-presence guess).
  - **billing: connected** — `STRIPE_SECRET_KEY` present AND `getActiveSubscriberStats` (a real query
    against `preference_signals`) returned `active_subscribers: 0`.
  - **email: connected** — a supported provider key is present (route-level check). Caveat, stated
    honestly: this is presence, not a live-send proof — `open_rate`/`click_rate` stay `null`.
  - **waitlist: connected** (independent of ADMIN_EMAIL) — the SAME authenticated call returned a real
    `waitlist_signups_total: 0` via `getWaitlistSubmissions`, satisfying the routine's own read need without
    needing `ADMIN_EMAIL` at all. `ADMIN_EMAIL` is now correctly recognized as a SEPARATE, lower-priority
    concern (only gates the human `/admin/waitlist` UI page) — downgraded in PENDING_OPS from high to normal.
  - Also got 3 REAL, structurally live experiments from the code (`landing_hero`, `h14_annual_nudge`,
    `h15_winback`) — all `status: running`, `result: null` because `visitors_7d` is genuinely `0` (zero
    exposures logged, not a hidden or fabricated result).
- **What did NOT change** (verified, not assumed): re-curled the live deployed URL directly — home 200,
  `/signup` + `/admin/waitlist` still 401, identical to runs 5-7. `SITE_GATE_PASSWORD` is still set — this
  is emphatically **NOT a public launch**, it's the owner wiring Stripe/Plausible/an email provider into the
  still-gated app. Confirmed via `docs/quality/QUALITY_SCORECARD.md` (as_of 2026-07-03, overall A,
  ship_gate_met true) and `PENDING_OPS` (`eas-build-submit-go-live` still `status: open`) that the mobile
  store submission has not happened — so per `ANALYSIS_PLAYBOOK`'s own phase-advance criterion (every
  ship-critical dim A/A+ AND the store live), `phase` correctly stays `pre_launch`, NOT `launching` — even
  though the snapshot route's OWN `phase` field says `"launching"`. That field is a narrower, code-level
  signal (`stripeConnected && no active subs -> "launching"`) that does not encode store-readiness at all;
  I deliberately did not copy it into `GROWTH_STATUS.phase` verbatim, and documented why inline so a future
  run doesn't get confused by the mismatch.
- **What this DOES and does NOT unlock**: `ANALYSIS_PLAYBOOK`'s pre-launch hard block ("BOTH a connected
  channel AND site_gate_up") is now cleared for the first time — `channels_connected: [email]`,
  `awaiting_connect: false`. This means the agent can act on REAL funnel/analytics/billing data going
  forward instead of all-null placeholders, and (per ANALYSIS_PLAYBOOK's EXECUTE section) could in
  principle queue content / monitor experiments. It does **NOT** mean automated outbound sends start:
  re-read `GTM_STANDARD.md` §6 (added via #399, "outbound doctrine — launch-gated 2-lane") this run and
  confirmed it is the newer, canonical, more explicit rule — BOTH outbound lanes (bespoke 1:1 AND
  high-volume automated) stay FULLY OFF pre-launch, even DRAFTING, regardless of channel connection, until
  `phase == post_launch` or an explicit owner launch flag. Where `ANALYSIS_PLAYBOOK`'s older EXECUTE-mode
  language and `GTM_STANDARD` §6's newer explicit block seem to differ on outbound specifically, `GTM_STANDARD`
  wins as the more recent, more explicit, canonical rule. Zero outreach drafted this run (correctly — no
  outbound at all pre-launch now, not just "no qualifying target" as in runs 2-7).
- **Did NOT do this run** (deliberate, not an oversight): no new demand-signal research (prioritized
  correctly verifying + documenting this major infra discovery over incremental research this cycle — a
  legitimate value-bar call, not padding-avoidance theater); no ROADMAP/VISION/BUSINESS_CASE steer (this is
  a real-state status refresh reflecting infra that came online, not a new causal, revenue-linked finding).
- **Updated**: `GROWTH_STATUS.md` (phase note explaining why NOT "launching"; `channels_connected`;
  `awaiting_connect`; `sources`/`validation` for all 4; real `funnel`/`channels`/`experiments`/`email`
  blocks; refreshed `learnings`/`next_actions`/`owner_blockers`). `PENDING_OPS.md` (`gtm-connect-analytics`/
  `-billing`/`-email`/`-waitlist` marked `done` with evidence; `waitlist-migration` downgraded
  high->normal since ADMIN_EMAIL no longer blocks the routine; `connect-channels` and `track-h-activation`
  moved to `in_progress` with an honest accounting of what's verified vs not; `spend-caps` emphasis
  elevated since real paid keys are now confirmed live).
- **Reviewed**: ran an independent reviewer subagent (fresh context, adversarial) against this run's full
  diff before committing. **First verdict: REQUEST_CHANGES** — every factual/technical claim held up (the
  CRON_SECRET auth path, the analytics-is-a-real-round-trip vs billing/email-are-presence-checks
  distinction, the phase-derivation logic, the store-not-live check, the §6 launch-gate read, both YAML
  blocks, the 3-file scope) but it caught two real inconsistencies: (1) the `waitlist-migration` PENDING_OPS
  item still said `blocks: growth-analytics` while its own updated prose said the opposite — fixed to
  `blocks: none`; (2) this very entry asserted in past tense that a review had already happened while still
  admitting the verdict was unfilled — fixed by writing the real verdict here instead of a placeholder.
  Both addressed before committing.
- **Hypothesis**: none new on PMF/retention (the snapshot endpoint doesn't expose those); this run's finding
  is infrastructure-state, not a funnel hypothesis.
- **Result**: 3 owner-side env connections (Stripe, Plausible, an email provider) verified live via a real
  authenticated round-trip — the first non-null, non-placeholder GTM data this product has ever produced.
  Funnel numbers themselves are still honestly `0` (zero real traffic/signups/subscribers to date).
- **Decision**: ship the GROWTH_STATUS/PENDING_OPS/GROWTH_MEMORY updates; zero outreach (correct, launch
  gate); no product steer (no causal finding, just real infra coming online).
- **Operational note**: this run is the first time this routine's own runtime environment carried
  `CRON_SECRET` — a reminder that FACTORY_STANDARD §28's "re-probe every run, owner progress is invisible to
  git" rule is exactly right: `git fetch`/`ListConnectors` showed nothing for 8 runs while the owner was
  quietly wiring real infra the whole time. Also worth flagging for a future run: `GTM_STANDARD` §6's
  outbound doctrine (added run 7's git-log, first acted on here) supersedes `ANALYSIS_PLAYBOOK`'s older,
  looser "channel connected -> EXECUTE mode may draft outreach" language for the outbound-specific case —
  channel-connection unlocks real DATA, never sends/drafts, until the launch gate opens. A future maintainer
  should reconcile `ANALYSIS_PLAYBOOK.md`'s EXECUTE section wording with `GTM_STANDARD` §6 so this isn't a
  recurring judgment call each run (flagged, not fixed, since editing `ANALYSIS_PLAYBOOK.md` beyond this
  run's own scope risks unrelated churn — a future run or the owner can reconcile the wording deliberately).

### 2026-07-04 (later cycle, run 7) — pre_launch, awaiting_connect, PREPARE mode (no owner movement since run 6)
- **Mode**: Still PREPARE (channels_connected: [] — no email/social channel; site_gate_up stays `true`,
  unchanged from run 6).
- **Did**:
  - Read GROWTH_STATUS, GROWTH_MEMORY, PENDING_OPS, GTM_SCORECARD, ANALYSIS_PLAYBOOK, OUTREACH,
    GTM_STANDARD, FACTORY_STANDARD. `git fetch origin main` found ONE new commit since run 6 (2560cd4,
    #399, "gtm: outbound doctrine — launch-gated 2-lane") — but it only edits `GTM_STANDARD.md` (the §6
    outbound-doctrine rewrite, already reflected in this run's read of that file), not app code or infra.
  - **Re-verified infra state directly** (no self-report): `curl` against the live deployed URL
    reproduced runs 5-6's exact split (home 200, `/signup`+`/admin/waitlist` 401,
    `GET /api/growth/snapshot` still `{"error":"Forbidden."}` — no CRON_SECRET/admin session held).
    `ListConnectors` unchanged: Gmail (connected, chat-enabled) + Google Drive (connected, chat-disabled)
    + Google Calendar (unknown/not connected) — still no analytics/DB/billing/email/social MCP tool.
    `site_gate_up` stays correctly `true`; ADMIN_EMAIL / PLAUSIBLE_API_KEY / an email provider / any
    channel remain unverified — 2 straight runs now with zero owner movement.
  - **Demand-signal (§10)**: closed run 6's next_action — fetched grand-screen.com's other listed
    pantry/grocery apps (Grocery AI, Our Groceries, Wonder Fridge, CookBook Recipe Manager). **Caught and
    corrected a real mistake this run**: my first pass used guessed/truncated URL slugs for Wonder Fridge
    and CookBook, got 404s, and wrongly logged that as "no reviews exist" — the independent adversarial
    reviewer (below) re-fetched the correct slugs directly and found real review pages with a genuine
    on-theme complaint I'd missed. Corrected result: Grocery AI: Shop, Cook, Pantry carries a real,
    verbatim barcode-scanning complaint (Bill Garner: "Tried a dozen items in my pantry and none of the
    barcodes registered. Even Walmart brands.") — this extends the "barcode/UPC scanning is unreliable
    and tedious" theme to a THIRD independent barcode-capable app (KitchenPal + My Pantry Tracker from
    run 6, now + Grocery AI). Our Groceries' review page is genuinely empty (this part of the original
    finding held up); Wonder Fridge and CookBook's reviews are real but not clearly on-theme (recipe/
    grocery-list/sharing gripes, not barcode/pantry) — correctly not cited. Logged the URL-slug lesson in
    `disconfirming_or_limitations` so a future run verifies slugs via search before treating a 404 as a
    negative result.
  - **Outreach research (§3b)**: closed run 6's next_action — searched the LAST untried angle from
    OUTREACH.md's target-type list, integration/distribution partners (receipt/email-parsing tool makers,
    budgeting apps). Surfaced only B2B receipt-OCR API vendors (Veryfi, Klippa, Mindee, Tabscanner —
    developer/enterprise tooling, not consumer distribution partners) and consumer grocery-budgeting apps
    (Out of Milk, GroceryBudget, Plateful, Banktrack — direct/adjacent competitors, not partners). None
    has a genuine "why they'd care about a pre-traction, zero-user, gated-waitlist app" — a credible
    integration ask needs traction this product doesn't have yet. **Zero outreach drafted this run**
    (correct — 6th consecutive run at zero, each for a genuine checked reason). This closes every
    target-type category OUTREACH.md names; a future run needs a genuinely NEW reason (an actual launch,
    a press hook, a newly-surfaced named contact) rather than re-running exhausted search angles.
  - Did NOT touch ROADMAP/VISION/BUSINESS_CASE — no new causal, significant data this run.
  - Ran an independent reviewer subagent (fresh context, adversarial) against this run's full diff before
    committing. **First verdict: REQUEST_CHANGES** — it independently re-fetched the grand-screen.com
    URLs and caught exactly the URL-slug mistake described above (wrong claim that Grocery AI/Wonder
    Fridge/CookBook had no on-theme reviews or 404'd), citing the real Bill Garner barcode complaint I'd
    missed. Corrected the demand_signal block, GROWTH_STATUS learnings/next_actions, and this entry
    accordingly before committing — everything else in the reviewer's pass (commit-history claim,
    file scope, YAML validity, outreach-rejection reasoning, no padding) checked out clean on the first
    pass.
- **Hypothesis**: none new on the funnel (still no analytics READ / billing / email-provider connection).
  This run's work is (a) an honest re-verification that nothing changed, (b) closing two dead-end search
  angles from run 6's next_actions — one genuinely negative (outreach), one that turned out to have a
  real positive finding the maker initially missed due to a URL bug (demand-signal), (c) confirming no
  new commit affects product/infra state.
- **Result**: Infra state unchanged (confirmed, not assumed). ONE new citable demand-signal quote found
  (Bill Garner / Grocery AI, corrected in after adversarial review); no new outreach target. Funnel/PMF
  numbers stay `0`/`null` (correct — still no connected source).
- **Decision**: Ship the GROWTH_STATUS/GROWTH_MEMORY/PENDING_OPS updates (reviewer's REQUEST_CHANGES
  addressed, not just reviewer-cleared on the first pass); outreach stays at zero (correct, all
  OUTREACH.md target-type categories now searched); no ROADMAP/VISION/BUSINESS_CASE steer (one more
  qualitative confirming citation, not a new causal, significant finding).
- **Operational note (maker≠checker actually caught something this run)**: the adversarial reviewer is
  not theater — it caught a real research error (wrong URL slugs mistaken for "app has no reviews")
  before it shipped a false negative into the dashboard. LESSON for future runs: when a grand-screen.com
  (or any aggregator) fetch 404s, verify the exact slug via a targeted WebSearch ("site:grand-screen.com
  <app name>") before concluding the app has no reviews — a 404 means the URL is wrong, not that the
  content doesn't exist. Both of run 6's `next_actions` items are now closed: demand-signal with a
  genuine new citation (Grocery AI's barcode complaint), outreach with an honest negative result
  (integration/distribution partners don't have a real "why they'd care" for a pre-traction app yet).
  Outreach has now searched every OUTREACH.md target-type category with zero qualifying targets — future
  runs should wait for a genuinely NEW reason rather than re-running exhausted angles. Demand-signal is
  NOT exhausted (Out of Milk's correct slug was never retried; grand-screen.com may list more apps) — a
  future run can keep mining it, just always verify slugs first.

### 2026-07-04 (run 6) — pre_launch, awaiting_connect, PREPARE mode (no owner movement since run 5)
- **Mode**: Still PREPARE (channels_connected: [] — no email/social channel; site_gate_up stays `true`,
  unchanged from run 5). First run of a new day; re-verified rather than assumed the run-5 state held.
- **Did**:
  - Read GROWTH_STATUS, GROWTH_MEMORY, PENDING_OPS, GTM_SCORECARD, ANALYSIS_PLAYBOOK, OUTREACH,
    BUSINESS_CASE, GTM_STANDARD, FACTORY_STANDARD. `git fetch origin main` showed **zero new commits**
    since run 5's merge (d21076f) — the first run since run 1 where a fetch found literally nothing new.
  - **Re-verified infra state directly** (no self-report): `curl` against the live deployed URL
    reproduced run 5's exact split (home/`/blog` 200, `/signup`+`/admin/waitlist` 401,
    `GET /api/growth/snapshot` still `{"error":"Forbidden."}` — no CRON_SECRET/admin session held).
    `ListConnectors` unchanged: only Gmail (connected) + Google Drive (connected, chat-disabled). So
    `site_gate_up` stays correctly `true`; ADMIN_EMAIL / PLAUSIBLE_API_KEY / an email provider / any
    channel remain unverified — none of runs 2-6's named owner blockers have moved.
  - **Demand-signal expansion (§10)**: tried a citable-aggregator sweep beyond Paprika/KitchenPal.
    `grand-screen.com/apps/my-pantry-tracker/reviews/` yielded a real, verbatim-confirmed quote (Steven
    Wilshire: "it will not scan QR codes. Can this be added PLEASE???") that extends the existing
    "barcode/UPC scanning is unreliable and tedious" theme to a SECOND independent barcode-first tracker
    — upgraded that theme's `durability` from `recent` (1 app) to `durable` (2 structurally-similar
    apps). Also tried Trustpilot (AnyList — 403 on WebFetch), grand-screen.com's own AnyList reviews page
    (zero reviews despite a 4.8/26,785 Play Store rating shown elsewhere on the aggregator), and
    WebSearch-surfaced "complaints" for SuperCook/Fridgely/Mealime — none of the latter could be verified
    verbatim by fetching the actual source page (some 403'd, one 404'd, one page simply didn't contain
    the summarized text). Correctly did NOT cite any of those — a search-engine paraphrase is not a
    citable quote per §10's evidence bar. Logged this pattern explicitly in `disconfirming_or_limitations`
    so future runs don't waste a cycle re-trying Trustpilot/Google-Play-direct and instead try
    grand-screen.com's OTHER listed pantry/grocery apps (Grocery AI, Wonder Fridge, Our Groceries,
    CookBook) — untried, and the same aggregator has proven reliable twice now.
  - **Outreach research (§3b)**: tried a genuinely NEW angle not covered in runs 2-5 (frugal-living /
    anti-food-waste / grocery-budgeting Substack newsletters, per OUTREACH.md's "relevant newsletter
    curators" target type). Surfaced "Front Yard Veggies" (Amy Bauer) — real, active, does publish
    grocery-spending/food-waste content — but its `/about` page has no published email or contact form
    (only social handles, which don't meet OUTREACH.md's bar), and its actual content center of gravity
    is gardening/homesteading, not pantry-tracking — a weak audience-fit "why they'd care." Rejected;
    **zero outreach drafted this run** (correct — 5th consecutive run at zero, each time for a genuine,
    checked reason, not a rubber-stamp).
  - Did NOT touch ROADMAP/VISION/BUSINESS_CASE — the barcode-theme durability upgrade is a qualitative
    confidence note within the existing §10 hard bound, not a new causal, significant finding; no figure
    changed.
  - Ran an independent reviewer subagent (fresh context, adversarial) against this run's full diff before
    committing.
- **Hypothesis**: none new on the funnel (still no analytics READ / billing / email-provider connection).
  This run's work is (a) an honest re-verification that nothing changed, (b) one real incremental
  demand-signal citation, (c) a correctly-negative outreach check on a new angle.
- **Result**: Infra state unchanged (confirmed, not assumed). One new verbatim-cited review quote added.
  Funnel/PMF numbers stay `0`/`null` (correct — still no connected source).
- **Decision**: Ship the GROWTH_STATUS/GROWTH_MEMORY updates (reviewer-cleared); outreach stays at zero
  (correct, no qualifying target); no ROADMAP/VISION/BUSINESS_CASE steer (no new causal, significant data).
- **Operational note**: this is the first run to find LITERALLY zero new commits on `git fetch` — worth
  distinguishing from runs 2-4 (which found unrelated product-factory commits between GTM runs) since it
  confirms the owner has been away, not just inactive on GTM-relevant items specifically.

### 2026-07-03 (later cycle, run 5) — pre_launch, awaiting_connect, PREPARE mode (with real owner progress)
- **Mode**: Still PREPARE (channels_connected: [] — no email/social channel confirmed connected), but
  **one of the two HARD-BLOCK preconditions flipped this run**: `site_gate_up` is now verified `true`.
- **Did**:
  - Read GROWTH_STATUS, GROWTH_MEMORY, GTM_SCORECARD, GTM_AUDIT_MEMORY, PENDING_OPS, ANALYSIS_PLAYBOOK,
    OUTREACH, BUSINESS_CASE. Checked git log since run 4's commit (ef16c9d) and found ONE new commit:
    `53b1834` ("fix(analytics): normalize Plausible domain to bare host", #396), authored directly by the
    owner (Subh Mukherjee, not the product factory / Claude Opus co-author line only on the merge). This
    fixes `normalizePlausibleDomain()` so a full-URL `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` value still produces a
    working Plausible integration — strong circumstantial evidence the owner had just set that env var and
    hit the bug in practice.
  - **Verified real infrastructure state directly against the live deployed app** (public HTTP only, no
    secrets, no auth): `curl` against `https://grocery-manager-web.vercel.app` showed home/`/blog`/`/privacy`
    return `200` (the site-gate-exempt routes) while `/signup` and `/admin/waitlist` return `401` (gated
    routes) — this exact split only happens when `SITE_GATE_PASSWORD` is set in Vercel and
    `apps/web/middleware.ts` is actively gating. This is the FIRST real owner-side movement confirmed in 4+
    runs of a named circuit breaker. Flipped `GROWTH_STATUS.site_gate_up` to `true` and marked PENDING_OPS
    `site-gate-prelaunch` `done` (with the evidence above), explicitly preserving the FUTURE "unset at
    launch" step so it isn't lost.
  - Also confirmed the deployed HTML contains a live Plausible tracking script with
    `data-domain="grocery-manager-web.vercel.app"` (bare host — matches the just-shipped fix), so
    `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is confirmed set. Did **NOT** mark analytics `connected`: the Stats-API
    read path (`GET /api/growth/snapshot`) needs `PLAUSIBLE_API_KEY` too, and that endpoint returned a
    Forbidden response without a `CRON_SECRET`/admin session this routine doesn't hold — fail-closed per
    GTM_STANDARD §4, stays `awaiting_connect` with the partial evidence noted.
  - Checked `ADMIN_EMAIL`: could NOT be verified — the `/admin/waitlist` `401` is fully explained by the
    site gate alone (it would 401 with or without `ADMIN_EMAIL` set), so this run correctly did NOT claim
    ADMIN_EMAIL is set. Re-checked `ListConnectors`: still only Gmail + Google Drive — no analytics/DB/
    billing MCP tool, so no direct read of `PLAUSIBLE_API_KEY` / `ADMIN_EMAIL` / any channel token is
    possible from this routine either way.
  - Did NOT re-run runs 2-4's outreach search queries (press/newsletter/food-tech-beat/general-landscape
    all already covered with the same correct negative result) — re-running them would be padding, not new
    evidence. Zero outreach drafts this run (correct).
  - Did NOT re-run the §10 demand-signal research (runs 3-4 already produced a full, cited synthesis; no
    new angle identified this run that would add real evidence rather than repetition).
  - Updated `GROWTH_STATUS`: `site_gate_up: true` (verified), `validation.analytics` partial-progress note,
    `learnings`/`next_actions`/`owner_blockers` refreshed to reflect the real change instead of repeating
    the unchanged circuit-breaker language from runs 2-4.
  - Ran an independent reviewer subagent (fresh context, adversarial) against this run's full diff before
    committing. **Verdict: APPROVE.** It independently re-read `packages/core/src/security/site-gate.ts`,
    `apps/web/middleware.ts`, `apps/web/app/admin/layout.tsx`, and the growth-snapshot route, and confirmed:
    `/signup` is exempt from neither the site gate nor any code path that would 401 it on its own, so the
    observed 401 is unconfounded evidence the gate is up; `/admin/waitlist`'s missing-ADMIN_EMAIL path
    redirects (307), never 401s, so that route's 401 is ALSO explained only by the site gate — confirming
    (not contradicting) this run's refusal to credit it toward ADMIN_EMAIL. No overclaim found (analytics
    stayed `awaiting_connect`, ADMIN_EMAIL not claimed, no fabricated metric); scope was clean (only the 3
    growth/pending-ops files); YAML re-validated. Zero requested changes.
- **Hypothesis**: none new on the funnel (still no analytics READ / billing / email-provider connection
  verified) — this run's work is a real infrastructure-state correction (site gate + partial analytics),
  not a new funnel or PMF hypothesis.
- **Result**: `site_gate_up` genuinely changed `false → true`, backed by reproducible public HTTP evidence.
  Funnel/PMF numbers are still `0`/`null` (correctly) — no analytics READ, billing, or email-provider
  connection is verifiable yet.
- **Decision**: Ship the GROWTH_STATUS/PENDING_OPS/GROWTH_MEMORY updates (reviewer-cleared); outreach stays
  at zero (correct, no new target); no ROADMAP/VISION/BUSINESS_CASE steer (this is an infrastructure-status
  correction, not a growth-lever finding).
- **Operational note**: this is the first run where the "same owner action, zero movement" circuit breaker
  from runs 2-4 needed to be UPDATED rather than repeated — a useful reminder to actually re-verify
  external state each run (via any means reachable, here: public HTTP against the deployed URL) rather than
  assuming a repeated blocker is still blocked.

### 2026-07-03 (later cycle) — pre_launch, awaiting_connect, RUN 4 (unchanged mode: PREPARE)
- **Mode**: PREPARE (site_gate_up: false; ListConnectors re-checked: still only Gmail [connected] +
  Google Drive [connected, not enabled in chat] — no analytics/DB/billing MCP tool, same as runs 1-3).
  No external actions taken. Noted the product factory shipped 5 more commits since run 3's commit
  (b38c3b5, 12:18 CDT) including wiring live Vercel crons for the h14 annual-nudge / h15 winback
  lifecycle-email routes (a3bfbbb, 17:50 CDT) — real retention infra, but inert pre-launch (no active
  subscribers yet), so no GROWTH_STATUS metric changes from it.
- **Did**:
  - Re-read GROWTH_STATUS, GROWTH_MEMORY, GTM_SCORECARD (still as_of 2026-07-01, not yet re-graded by
    the independent GTM Auditor since run 2's fixes — nothing for me to act on there, I only consume it).
  - **Closed run 3's next_action**: ran 2 direct `WebSearch` calls with `allowed_domains:["reddit.com"]`
    and got an explicit API error both times — "domains are not accessible to our user agent:
    ['reddit.com']" — confirming this is a hard crawler-access block, NOT a query-phrasing problem as
    run 3 speculated. Recorded this as a closed dead end in `next_actions` so future runs stop
    re-attempting Reddit-scoped queries.
  - Attempted to broaden demand-signal sourcing beyond Paprika/KitchenPal: WebSearch surfaced candidate
    AnyList complaint quotes via a justuseapp.com review aggregator, but `WebFetch` on that exact URL
    returned HTTP 403 — could not verify the quote/URL/reviewer precisely, so did NOT add it as a cited
    theme (would have been an unverified quote lifted from a search-engine summary, which the honesty
    bar forbids). No new demand_signal evidence this run; the run-3 themes (2 durable, 1 partial) stand
    unchanged.
  - **Fixed a real stale metric**: `GROWTH_STATUS.content.published_7d` was `0` and `scheduled_next_7d`
    was `1`, still describing the "pantry-tracker-apps-2026" post as staged — but
    `apps/web/app/blog/posts.ts:223` shows `publishedAt: "2026-06-29"`, which is inside the 7-day window
    as of today (2026-07-03). Corrected to `published_7d: 1` / `scheduled_next_7d: 0` — a code-derived,
    honest correction, not a new claim. Did NOT draft a 5th blog post: with zero analytics feedback and
    no newly-identified content gap, a new post this run would be padding, not value-bar-clearing work.
  - Outreach research (§3b): one more search angle (general 2026 food-tech/grocery-app landscape,
    broader than runs 2-3's press-specific queries) surfaced only SEO listicles and funding-news
    aggregators — zero named journalists/curators with a genuine reason to care about a pre-traction,
    gated waitlist. **Zero outreach drafts this run** — correct per OUTREACH.md.
  - Updated GROWTH_STATUS: learnings/next_actions/owner_blockers refreshed; re-escalated the circuit
    breaker (now 4+ runs / 5 days, re-confirmed via a fresh ListConnectors call + a fresh PENDING_OPS
    re-read showing all 5 relevant items byte-identical to run 3's `status: open`).
  - Ran an independent reviewer subagent (fresh context, adversarial) against this run's diff before
    committing.
- **Hypothesis**: none new on the funnel (still no analytics connected). This run's work is
  housekeeping/honesty (closing a dead-end search method, fixing a stale metric) plus a repeated,
  correctly-negative outreach check — not a new funnel or PMF hypothesis.
- **Result**: Not measurable on the funnel (still no Plausible/ADMIN_EMAIL/Stripe/email provider). The
  content-metric fix and the closed Reddit dead-end are the real, if modest, deliverables this run.
- **Decision**: Ship the GROWTH_STATUS/GROWTH_MEMORY updates (reviewer-cleared); outreach stays at zero
  (correct); no ROADMAP/VISION/BUSINESS_CASE steer (no new data since run 3's citation-only footnote).
- **Operational note**: same conclusion as runs 1-3 — this routine has no Supabase/Plausible/Stripe MCP
  tool; PENDING_OPS + GROWTH_STATUS remain the only way to detect an owner-side env change.

### 2026-07-03 — pre_launch, awaiting_connect, RUN 3 (unchanged mode: PREPARE)
- **Mode**: PREPARE (site_gate_up: false; no channels connected; ListConnectors confirms only Gmail +
  Google Drive are connected — no Supabase/Plausible/Stripe MCP tool reachable, same as runs 1-2). No
  external actions taken.
- **Did**:
  - Read GROWTH_STATUS, GROWTH_MEMORY, GTM_SCORECARD, PENDING_OPS. Confirmed PENDING_OPS is byte-for-byte
    unchanged on all 4 `gtm-connect-*` items and `site-gate-prelaunch` since run 2 (2026-07-01) — zero
    owner movement across 2 days / multiple other-track commits (quality/bookkeeping runs touched
    unrelated files).
  - Noticed GTM_STANDARD gained two new sections since run 2: **§10 pre-launch demand validation**
    (added 2026-07-02, PR #344) and **§11 marketing creative** (added 2026-07-02, PR #352/#353/#361).
    §11 requires a connected posting channel to matter (none connected — correctly out of scope this
    run). §10 is pure research, doable in PREPARE mode — did it this run.
  - **§10 demand validation**: ran 9 WebSearch queries (Reddit-scoped phrasing x6, competitor-review
    x3) + 2 WebFetch calls against review aggregators. Reddit-scoped queries returned zero citable
    exact-quote threads (a tool/method limitation, logged honestly — not "no Reddit pain exists").
    Competitor App/Play Store review aggregators (ComplaintsBoard for Paprika, grand-screen.com for
    KitchenPal) DID surface real, quoted, sourced complaints. Two of three themes found are DURABLE
    (recur across a recipe-first app AND a barcode-first app: "the pantry is never up-to-date," "purchases
    don't automatically flow into the pantry") and squarely match this product's receipt/Gmail-import +
    depletion-tracking core loop — corroborates LESSON-0 with a second, independent evidence type. The
    third theme (barcode/UPC scanning is tedious/unreliable) is only PARTIALLY solved by this product,
    since `/barcode` is itself a manual per-item flow — logged as an honest gap, not a win. Wrote the full
    synthesis + citations to `GROWTH_STATUS.demand_signal`.
  - Added ONE citation-only footnote to `docs/BUSINESS_CASE.md` §3 (the signup→paid input table) noting
    this real-review corroboration for the Gmail-import-hook justification of the base 4% rate. **No
    number was changed** — per §10's hard bound, qualitative demand signal never becomes a fabricated
    figure. Not a ROADMAP/VISION/BUSINESS_CASE-number steer (§3): this reinforces an existing bet with a
    second evidence type, it doesn't introduce new information that would redirect the roadmap, so no
    steer authority was exercised.
  - Ran an independent reviewer subagent (fresh context, told to adversarially refute) against this run's
    full diff before committing — see its verdict below.
  - Outreach research (§3b): per run 2's next_action, searched for a food-tech beat journalist/newsletter
    (narrower than run 2's general food/recipe query). Surfaced Food Dive, Grocery Dive, FoodTech Weekly,
    DigitalFoodLab — all are B2B/funding-round trade press covering deals and enterprise grocery-tech, not
    consumer app launches, so there's no genuine "why they'd care" about a pre-traction consumer waitlist
    and no realistic reply to anticipate. **Decision: zero outreach drafts this run** — correct per
    OUTREACH.md.
  - Updated GROWTH_STATUS: as_of -> 2026-07-03; added `demand_signal` block; refreshed
    learnings/next_actions/owner_blockers; escalated the circuit-breaker language (3+ runs / 5 days now,
    with an explicit re-check that PENDING_OPS is unchanged, not just "presumed unchanged").
- **Hypothesis**: none new on the funnel (still no analytics connected). The demand-signal work is a
  qualitative confidence-raise on an EXISTING hypothesis (LESSON-0 / the Gmail-import conversion hook),
  not a new funnel hypothesis.
- **Result**: Not measurable on the funnel (still no Plausible/ADMIN_EMAIL/Stripe/email provider). The
  demand-signal synthesis itself is the deliverable this run — real, cited, and honest about its limits.
- **Decision**: Ship the demand_signal block + the BUSINESS_CASE footnote (reviewer-cleared); outreach
  stays at zero (correct); no ROADMAP/VISION/BUSINESS_CASE-number steer.
- **Operational note**: confirmed via `ListConnectors` that this routine has exactly Gmail + Google Drive
  connected (no analytics/DB/billing MCP) — same conclusion as runs 1-2's "no Supabase/DB tool" note, now
  backed by an explicit tool call instead of an assumption.

### 2026-07-01 — pre_launch, awaiting_connect, RUN 2 (unchanged mode: PREPARE)
- **Mode**: PREPARE (site_gate_up: false; no channels connected; no Supabase/analytics MCP tool
  reachable from this routine — same as run 1). No external actions taken.
- **Did**:
  - Read GROWTH_STATUS, GROWTH_MEMORY, and the independent GTM_SCORECARD (graded today by the
    separate GTM Auditor routine: overall A, ship_gate_met true) — consumed its `top_gaps` as the
    highest-priority in-repo work per GTM_STANDARD §8, since two are directly fixable without new
    data: (1) `self_validation_honesty` structural gap — GTM_STANDARD §4 prescribes an explicit
    `validation:` block + `gtm-connect-<source>` owner-action ids; neither existed. (2)
    `compliance` gap — an unsourced 'well-reviewed, large user base' claim about KitchenPal in the
    competitor-comparison blog post.
  - Fixed both: added a `validation:` block to GROWTH_STATUS.md (per-source status +
    `owner_action: gtm-connect-<source>` id) and 4 matching URGENT items in PENDING_OPS.md
    (`gtm-connect-waitlist/analytics/billing/email`, cross-referencing the existing detailed
    runbook items rather than duplicating instructions). Removed the unsourced KitchenPal claim
    from `apps/web/app/blog/posts.ts` (kept the factual, defensible description).
  - Ran `scripts/preflight.sh` before committing (per this repo's gate discipline) and it caught a
    real, pre-existing bug: PENDING_OPS.md's `wire-e2e-roundtrip-ci` item had `priority: medium`,
    which isn't one of the schema's valid values (`urgent|high|normal`) — this was silently
    breaking the OWNER_ACTIONS YAML parse for the WHOLE dashboard (not something my edit caused,
    but squarely in the file this run already owns). Fixed to `priority: normal`. Independent
    reviewer confirmed everything else in this run's diff (both new YAML blocks, the blog edit)
    parses clean and is scope-appropriate.
  - Outreach research (§3b): searched for a genuinely strategic press/newsletter target. Found
    "Pantry by Hilary" (a weekly Substack) but it's a personal recipe/meal-plan newsletter, not a
    food-tech/pantry-tooling beat — no real "why they'd care", and no published contact surfaced
    (Substack blocked direct fetch; no contact page found via search). A second search for food
    journalist lists also 403'd on fetch. **Decision: zero outreach drafts this run** — correct per
    OUTREACH.md when no target clears the bar (name + why + realistic reply + real contact).
  - Updated GROWTH_STATUS: as_of → 2026-07-01; learnings/next_actions/owner_blockers refreshed;
    flagged a CIRCUIT BREAKER (3rd run citing the same unresolved owner actions with zero owner
    movement — SITE_GATE_PASSWORD + ADMIN_EMAIL named as the single cheapest, highest-leverage pair
    to unblock next).
- **Hypothesis**: none new — no analytics connected, so no funnel/PMF hypothesis to test this run.
- **Result**: Not measurable (still no Plausible, ADMIN_EMAIL, Stripe, or email provider). All
  funnel/pmf: 0/null, honestly.
- **Decision**: In-repo honesty/structure fixes shipped; outreach stays at zero (correct); no
  ROADMAP/VISION/BUSINESS_CASE steer (no new data to justify one — same as run 1).
- **Operational note**: This routine has no Supabase/DB MCP tool and no Vercel access — it cannot
  itself verify whether the owner has changed any env var since run 1. Confirming site_gate_up /
  ADMIN_EMAIL / provider keys requires either the owner updating PENDING_OPS/GROWTH_STATUS directly
  or a future run gaining a read-only analytics/DB tool.

### 2026-06-29 — pre_launch, awaiting_connect, FIRST GROWTH AGENT RUN
- **Mode**: PREPARE (site_gate_up: false; no channels connected). No external actions taken.
- **Did**:
  - Full orientation: read FACTORY_STANDARD, VISION, ROADMAP, GROWTH_STATUS, ANALYSIS_PLAYBOOK,
    OUTREACH rails, BRAND_KIT, EMAIL_LIFECYCLE, CONTENT_DRAFTS, LAUNCH_PLAN, PRESS_KIT, PENDING_OPS,
    landing page A/B variants (page.tsx), all 3 blog posts (posts.ts).
  - Competitor research via WebSearch: mapped the pantry tracker landscape (Paprika, Mealime, AnyList,
    KitchenPal, SuperCook, MealBoard, Foodat, Recipy). Key finding: no mainstream app auto-fills from
    Gmail receipts + tracks depletion rates. This is a real, unaddressed positioning gap.
  - Drafted the 4th blog post ("Pantry tracker apps: what actually works in 2026") — honest competitor
    comparison targeting high-intent searchers evaluating options. Covers Paprika (recipe notebook, manual
    pantry), Mealime (meal planning, no pantry), AnyList (shared lists, light pantry), KitchenPal
    (dedicated tracker, manual/barcode). No invented metrics or false competitor claims.
  - Updated GROWTH_STATUS: as_of → 2026-06-29; added learnings, next_actions, owner_blockers.
  - Filed daily growth report as Gmail draft to subh.mukherjee1996@gmail.com.
- **Hypothesis**: The "pantry tracker apps" comparison post targets high buyer-intent search queries.
  Not yet measurable (no analytics connected).
- **Result**: Not measurable (no Plausible, no ADMIN_EMAIL, no connected source). All funnel: 0/null.
- **Decision**: Blog post staged; will measure organic traffic once Plausible connects.
- **Owner blockers surfaced**: SITE_GATE_PASSWORD (critical, blocks all execute-mode outreach);
  ADMIN_EMAIL (blocks real waitlist count); RESEND_API_KEY (warm leads not nurtured); PLAUSIBLE domain
  (no traffic measurement); final app name choice (all copy uses [APP_NAME] placeholder).
- **Operational note**: No `gh` CLI available in this environment — using GitHub MCP tools for push/PR.
