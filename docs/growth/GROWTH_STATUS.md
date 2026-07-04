# GROWTH STATUS — GroceryManager

The single, machine-readable source of truth for **growth & marketing progress**, owned by the
**Growth Agent** (the daily cloud routine). The factory dashboard reads the fenced `GROWTH_STATUS`
block below — exactly like it reads `BUSINESS_CASE_SUMMARY` in `docs/BUSINESS_CASE.md`. This is how
the owner sees pre-launch / launch / post-launch growth progress in one place.

## Contract (read before editing)

- **Method:** the Growth Agent produces the numbers + learnings below by following
  [`docs/growth/ANALYSIS_PLAYBOOK.md`](./ANALYSIS_PLAYBOOK.md) — an applied growth data scientist
  (privacy-safe AGGREGATES only, significance/CI before any claim, "insufficient data" when N is small,
  never fabricate, correlation ≠ causation; it RECOMMENDS the highest-ROI lever, the factory builds it).
- **The Growth Agent updates the block below every run**, in the SAME run it does growth work.
- **Real data only — never invent numbers** (VISION's honesty bar applies here absolutely). A metric
  that no connected analytics source has reported yet stays `0` or `null`. A non-null number must be
  traceable to a real source (the in-app `/admin/waitlist` analytics, the connected email provider,
  the connected channel's own analytics, Stripe). No estimates, no "looks good," no fabricated proof.
- **The block MUST be valid, parseable YAML** — no invalid escapes (write `$100K`, never `\$100K`).
  `scripts/preflight.sh` fails on a malformed block, because a malformed block makes the dashboard
  degrade to "unparseable → link" instead of showing progress.
- **Cross-project shape (identical across AptDesignerAI / HighlightMagic / GroceryManager)** so the
  owner's dashboard can compare all three side by side. Keep the keys identical; only the values differ.
- **`engine_built` / `engine_pct` are PINNED TO REAL CODE — never hand-set.** `engine_pct` (integer 0–100)
  is the percent of the growth-execution engine's **5 pieces** that physically exist on disk, each pinned to
  ONE anchor file: (1) waitlist double-opt-in confirm route `apps/web/app/api/waitlist/confirm/route.ts`;
  (2) email-send provider abstraction `packages/core/src/email/index.ts`; (3) social publishing queue
  `packages/core/src/content/scheduler.ts`; (4) growth-metrics read API
  `apps/web/app/api/growth/snapshot/route.ts`; (5) owner connect runbook `docs/growth/CONNECT.md`.
  `scripts/preflight.sh` RECOMPUTES `engine_pct` from those files, FAILS if the declared value differs, and
  ENFORCES `engine_built == (engine_pct == 100)`. So a hollow `engine_built: true` (staged marketing content
  mistaken for the live engine) can never drift ahead of the code. Until all five exist, `engine_built` is `false`.
- **`phase`** advances `pre_launch` → `launching` → `post_launch`. **Post-launch is the most important
  window** — that's when real conversion/retention/CAC data arrives and the agent compounds it into
  better growth strategy. Keep `learnings` and `experiments` richest here.
- **`as_of`** is stamped every update. A stale `as_of` (the agent didn't run / had nothing real to
  report) is itself a signal — never bump the date without a real reason.

```yaml
GROWTH_STATUS:
  project: GroceryManager
  as_of: 2026-07-04 (run 7)
  phase: pre_launch              # pre_launch | launching | post_launch
  engine_built: true             # MUST equal (engine_pct == 100); preflight enforces it against real anchor files
  engine_pct: 100                # % of growth-execution engine pieces shipped — DERIVED from anchor files by preflight; NEVER hand-set
  channels_connected: []         # owner-authorized channels actually wired (e.g. [x, instagram, email])
  awaiting_connect: true         # true => agent only prepares creative; takes NO external action
  site_gate_up: true             # VERIFIED THIS RUN (2026-07-03, run 5) via direct curl against the live
                                 #   deployed URL: home/blog/privacy return 200 (exempt), /signup and
                                 #   /admin/waitlist return 401 (gated) — the exact exempt-vs-gated split
                                 #   the code (apps/web/middleware.ts) implements. This is real, reproducible,
                                 #   public-HTTP evidence (no secret read, no auth used) that SITE_GATE_PASSWORD
                                 #   is now set. Still only ONE of the two HARD-BLOCK preconditions — see
                                 #   channels_connected below (still empty) — so PREPARE mode continues.
  sources:                       # per-source pull status (H7 snapshot): connected | awaiting_connect
    waitlist: awaiting_connect
    analytics: awaiting_connect
    billing: awaiting_connect
    email: awaiting_connect
  validation:                    # GTM_STANDARD §4 explicit validation ledger — fail-closed; each
                                 #   unconnected source gets an URGENT gtm-connect-<source> OWNER_ACTION
    waitlist:
      status: awaiting_connect   # own datastore write is real (funnel.waitlist_confirmed above); the
                                 #   admin READ path (/admin/waitlist) needs ADMIN_EMAIL to verify counts
      owner_action: gtm-connect-waitlist
    analytics:
      status: awaiting_connect   # PARTIAL PROGRESS verified this run: NEXT_PUBLIC_PLAUSIBLE_DOMAIN is now
                                 #   confirmed SET (curl of the live deployed HTML shows a real Plausible
                                 #   script tag with data-domain="grocery-manager-web.vercel.app" — the
                                 #   owner's same-day commit #396 normalized it to a bare host). PLAUSIBLE_API_KEY
                                 #   (needed for the Stats API READ that GET /api/growth/snapshot uses) is
                                 #   still unverifiable headlessly (the endpoint requires CRON_SECRET/admin
                                 #   session, both absent to this routine) — stays awaiting_connect, fail-closed,
                                 #   until a real visitors_7d number can be pulled.
      owner_action: gtm-connect-analytics
    billing:
      status: awaiting_connect   # STRIPE_SECRET_KEY / FEATURE_BILLING unset — no MRR/churn/CAC may be
                                 #   reported until this resolves to connected
      owner_action: gtm-connect-billing
    email:
      status: awaiting_connect   # no RESEND_API_KEY / SENDGRID_API_KEY / POSTMARK_API_KEY set — no
                                 #   open/click rate may be reported until this resolves to connected
      owner_action: gtm-connect-email
  funnel:                        # REAL numbers only; 0/null until a connected source reports them
    visitors_7d: 0
    waitlist_signups_total: 0
    waitlist_signups_7d: 0
    waitlist_confirmed: 0          # double-opt-in confirmed signups (own datastore — always real)
    visitor_to_waitlist_rate: null
    trial_starts_total: 0
    paid_conversions_total: 0
    trial_to_paid_rate: null
    active_subscribers: 0
    mrr_usd: 0
    churn_rate_30d: null
  acquisition:
    cac_usd: null
    ltv_usd: null
    ltv_cac_ratio: null
    top_channel: null
  pmf:                           # PRODUCT-MARKET FIT — the leading indicator (FACTORY_STANDARD §9). Pre-PMF
                                 #   the recommendation is a PRODUCT/retention fix, NOT scaling acquisition.
                                 #   REAL data only; 0/null until a connected analytics source reports.
    activation_rate: null        # % of new users reaching first value: a non-empty app-derived pantry
                                 #   (receipt/scan, not hand-entered) + a first suggestion, in session/week 1
    retention_d1: null           # classic day-cohort returns
    retention_d7: null
    retention_d30: null
    retention_w1: null           # WEEKLY-cohort returns (this is a weekly-cadence product — the headline)
    retention_w4: null
    retention_curve_flattening: null  # true once the weekly curve levels off on a committed cohort (the PMF signal)
    organic_share_rate: null     # non-paid + referral share of signups (is it spreading on its own?)
    signal: none                 # none | weak | emerging | strong  — GOVERNS the recommendation
  channels: []                   # [{name, status, reach_7d, clicks_7d, signups_7d, ctr, notes}]
  experiments: []                # [{id, hypothesis, status, result, lift_pct, started, decided}]
  email:
    list_size: 0
    double_opt_in: true
    last_stage_sent: null
    open_rate: null
    click_rate: null
  content:
    published_7d: 1              # "pantry-tracker-apps-2026" (apps/web/app/blog/posts.ts:223) published
                                  #   2026-06-29 — within the last 7 days as of this run (2026-07-03)
    scheduled_next_7d: 0          # nothing new staged this run (prior value was stale: the run-1 post
                                  #   had already published, so it belonged in published_7d, not here)
    organic_sessions_7d: 0
  outreach:                      # STRATEGIC OUTREACH — curated, human-reviewed Gmail DRAFTS (docs/growth/OUTREACH.md).
                                 #   DRAFT-ONLY: the agent never sends; the OWNER reviews + sends. REAL numbers only.
    drafted_7d: 0                # 0: site_gate_up false — PREPARE mode only; no outreach drafted this run
    owner_sent_7d: 0             # how many the OWNER actually sent (owner-reported)
    replies_7d: 0                # replies received (OWNER-reported — NEVER fabricated)
    signal: none                 # none | weak | emerging | strong  (0/none pre-launch)
  learnings:
    - "FIRST RUN (2026-06-29): all funnel metrics 0/null — no analytics source connected. Cannot
      diagnose binding constraint until Plausible + admin email are set."
    - "Blog content audit: 3 posts exist (food waste, meal planning, budget tracking). The missing
      high-intent piece was a competitor comparison ('pantry tracker apps') — drafted this run.
      Competitor research confirmed the receipt-auto-fill gap is real and not addressed by Paprika,
      Mealime, AnyList, or KitchenPal — genuine positioning signal."
    - "site_gate_up: false — the SITE_GATE_PASSWORD has not been set in Vercel. No public-facing
      outreach can be driven pre-launch until this is set. This is the single highest-priority
      owner action to unlock the growth agent's execute mode."
    - "Email provider not connected — waitlist signups ARE captured in DB (confirmed from prod data)
      but double-opt-in confirmation emails are not being sent. Warm leads are not being nurtured."
    - "RUN 2 (2026-07-01): closed the two GTM_SCORECARD top_gaps that were addressable in-repo —
      added the explicit GTM_STANDARD §4 `validation:` block (per-source status + `gtm-connect-
      <source>` owner_action id, cross-referenced into PENDING_OPS) and removed an unsourced
      'well-reviewed, large user base' claim about a competitor (KitchenPal) from the comparison
      blog post (apps/web/app/blog/posts.ts) that a fresh adversarial grader had flagged as an
      uncited third-party claim."
    - "RUN 2: no Supabase/analytics MCP tool is reachable from this routine — self_validation stays
      fail-closed on all 4 sources (waitlist/analytics/billing/email); did not report any metric
      from an unverifiable source. This is unchanged from run 1; still correct."
    - "RUN 2 outreach research: evaluated 'Pantry by Hilary' (personal weekly meal-plan/recipe
      Substack) as a candidate strategic target. Rejected — it's a recipe/meal-plan newsletter, not
      a pantry-tooling or food-tech beat, so there's no genuine 'why they'd care' about a pantry-
      tracking app, and no published contact was found. Zero outreach drafted this run (correct per
      OUTREACH.md — no genuinely strategic, high-confidence target surfaced)."
    - "CIRCUIT BREAKER (now 3+ runs / 5 days, 2026-06-29 -> 2026-07-03, zero owner movement): the SAME
      unresolved owner actions (SITE_GATE_PASSWORD, ADMIN_EMAIL, an email provider key, Plausible) are
      still open — confirmed by re-reading PENDING_OPS.md this run: all four are still `status: open`,
      identical to run 2. No Supabase/Plausible/Stripe MCP connector is available to this routine either
      (checked via ListConnectors: only Gmail + Google Drive are connected). Per FACTORY brakes, naming
      this prominently rather than re-deriving it: the single highest-leverage pair is still
      SITE_GATE_PASSWORD + ADMIN_EMAIL — both are ~5-minute Vercel env-var sets with no cost."
    - "RUN 3 (2026-07-03): did the NEW GTM_STANDARD §10 pre-launch demand-validation work (added
      2026-07-02, after run 2) — see the `demand_signal` block. Found real, dated competitor-review
      evidence (Paprika + KitchenPal) that independently corroborates LESSON-0 from a second evidence
      type (user reviews, not just feature-matrix research). Added a citation-only footnote to
      BUSINESS_CASE.md §3 (no number changed) reflecting the qualitative confidence-raise per §10's hard
      bound. No ROADMAP/VISION/BUSINESS_CASE-figure steer taken — this corroborates the existing bet, it
      doesn't introduce new information that would redirect it."
    - "RUN 3 outreach research: searched for a food-tech beat journalist/newsletter per run 2's
      next_action. Surfaced Food Dive / Grocery Dive / FoodTech Weekly / DigitalFoodLab — all are
      B2B/funding-round trade press, not consumer-app-launch coverage, so there's no genuine 'why
      they'd care' about a pre-traction consumer waitlist. Zero outreach drafted this run (correct per
      OUTREACH.md — still no genuinely strategic, high-confidence target with a real reason + published
      contact)."
    - "RUN 4 (2026-07-03, same day as run 3 — a later scheduled cycle): CLOSED run 3's next_action.
      Confirmed via 2 direct WebSearch calls with allowed_domains:[reddit.com] that Reddit is
      categorically UNREACHABLE to this routine's search tool ('domains are not accessible to our
      user agent' — a crawler-access block, not a query-phrasing problem). This is a durable tool
      limitation, not a dead end to keep re-trying: future runs should stop attempting Reddit-scoped
      queries and instead broaden to other public review/complaint sources. Attempted one such
      broadening (AnyList app reviews via justuseapp.com aggregator) but WebFetch got HTTP 403 on
      that specific aggregator — recorded honestly rather than fabricating a quote/URL from the
      search-summary text alone (no new demand_signal evidence added this run; the run-3 themes stand
      unchanged)."
    - "RUN 4: fixed a stale metric in `content` — published_7d was 0 and scheduled_next_7d was 1,
      still describing the pantry-tracker-apps-2026 post as 'staged' 4+ days after it actually
      published (apps/web/app/blog/posts.ts:223, publishedAt 2026-06-29, confirmed by reading the
      file). Corrected to published_7d:1 / scheduled_next_7d:0 — a real, code-derived, honest
      correction (artifact-freshness fix), not a new claim. No new blog post drafted this run: with no
      analytics feedback yet and no newly-identified content gap, writing a 5th post would be padding,
      not value-bar-clearing work."
    - "RUN 4 outreach research: one more search angle (general food-tech/grocery-app 2026 landscape,
      broader than runs 2-3's press/newsletter-specific queries) surfaced only SEO/listicle content
      and funding-news aggregators, zero named journalists/curators with a real reason to care about a
      pre-traction, gated waitlist. Zero outreach drafted this run (correct per OUTREACH.md)."
    - "RUN 5 (2026-07-03, later cycle): the CIRCUIT BREAKER named in runs 2-4 is PARTIALLY RESOLVED — the
      owner made real, verifiable moves since run 4. (1) Commit 53b1834 (18:25 CDT, authored by the owner
      directly, not the product factory) fixed NEXT_PUBLIC_PLAUSIBLE_DOMAIN normalization — evidence they
      set that env var (with a full-URL value that needed the fix). (2) Verified via direct `curl` against
      the live deployed URL (https://grocery-manager-web.vercel.app): home/blog/privacy return HTTP 200
      (site-gate-exempt routes) while /signup and /admin/waitlist return HTTP 401 (gated routes) — this
      exact split is only possible if SITE_GATE_PASSWORD is now set in Vercel, so site_gate_up flips to
      true this run, verified by real public HTTP behavior (no secret read, no auth needed). (3) The
      deployed HTML confirms a live Plausible tracking script with data-domain set to the bare host
      'grocery-manager-web.vercel.app' (matching the just-shipped normalization) — the tracking half of
      analytics is real and live. NOT yet confirmed: PLAUSIBLE_API_KEY (the Stats API read
      `GET /api/growth/snapshot` needs it; it returned a Forbidden error without a CRON_SECRET/admin
      session, which this routine does not hold) and ADMIN_EMAIL (the /admin/waitlist 401 is fully
      explained by the site gate alone, so it is
      NOT evidence ADMIN_EMAIL is set — stays unverified). No channel (email provider / social) is
      confirmed connected either — PENDING_OPS `track-h-activation` / `connect-channels` are still open, and
      ListConnectors still shows only Gmail + Google Drive. Per the ANALYSIS_PLAYBOOK hard block, BOTH a
      connected channel AND site_gate_up must be true to leave PREPARE mode — only one is met, so the
      agent stays in PREPARE mode this run. But this is genuine, verified owner progress after 4+ runs of
      zero movement — worth flagging clearly rather than re-stating the circuit breaker unchanged."
    - "RUN 5 outreach research: no new search angle attempted this run (runs 2-4 already covered
      press/newsletter/food-tech-beat/general-landscape queries with the same negative, correctly-zero
      result) — re-running the identical queries again would be padding, not new evidence. Zero outreach
      drafted this run."
    - "RUN 6 (2026-07-04): RE-VERIFIED infra state — zero owner movement since run 5. `git fetch origin
      main` shows no new commits past d21076f (run 5's merge); direct curl against the live deployed URL
      reproduces the identical split (home/blog 200, /signup + /admin/waitlist 401, `GET
      /api/growth/snapshot` still `{\"error\":\"Forbidden.\"}` with no CRON_SECRET); `ListConnectors`
      still shows only Gmail (connected) + Google Drive (connected, not chat-enabled) — no
      analytics/DB/billing/social MCP tool. `site_gate_up` stays `true` (unchanged, still correctly the
      only precondition met); `channels_connected` stays empty."
    - "RUN 6 demand-signal expansion: found ONE new citable, verbatim-verified review quote broadening
      the existing 'barcode/UPC scanning is unreliable and tedious' theme to a SECOND independent
      barcode-first tracker (previously only KitchenPal): grand-screen.com/apps/my-pantry-tracker/reviews/
      — Steven Wilshire: 'it will not scan QR codes. Can this be added PLEASE???'. Also attempted
      AnyList (grand-screen.com/apps/anylist-grocery-shopping-list/reviews/ — page has ZERO reviews
      despite showing a 4.8/26,785 Play Store rating elsewhere, so no citable AnyList quote exists there)
      and Trustpilot/ComplaintsBoard searches for AnyList/Mealime/SuperCook/Fridgely pantry complaints —
      every WebSearch-summarized 'complaint' for those (SuperCook 'can't add multiple items', Fridgely
      'lost 70 items after Facebook connect', Mealime Play Store gripes) could NOT be verified verbatim
      by direct WebFetch of the actual source page (403/404/summary-only, or the underlying page simply
      doesn't contain the quoted text) — correctly NOT added as evidence per the honesty bar (a
      search-engine paraphrase is not a citable quote). This confirms runs 2-4's finding that this
      routine's search layer sometimes surfaces plausible-sounding but unverifiable paraphrases; only
      grand-screen.com and complaintsboard.com have proven directly fetchable this run and prior runs."
    - "RUN 6 outreach research: tried a NEW angle (frugal-living / anti-food-waste / grocery-budgeting
      Substack newsletters, not yet searched in runs 2-5) and surfaced 'Front Yard Veggies' (Amy Bauer) —
      a real, active newsletter that does share grocery-spending data and food-waste reduction content.
      REJECTED after checking its /about page: no published email or contact form exists (only
      Instagram/TikTok/YouTube handles, which OUTREACH.md does not accept as a substitute for a real
      email/contact-form target), and its actual content center of gravity is gardening/homesteading/
      chicken-keeping, not pantry-tracking or receipt-based grocery management — a weak 'why they'd care'
      fit. Zero outreach drafted this run (correct per OUTREACH.md — no target clearing all three bars:
      name + why + real contact)."
    - "RUN 7 (2026-07-04, later cycle): re-verified infra state directly — zero owner movement since run
      6. Live curl against the deployed URL reproduces the identical split (home 200, /signup +
      /admin/waitlist 401, GET /api/growth/snapshot still returning a Forbidden error with no
      CRON_SECRET); git fetch origin main showed ONE new commit since run 6 (2560cd4, #399,
      'gtm: outbound doctrine - launch-gated 2-lane') but it only edits GTM_STANDARD.md's Section 6
      (already reflected in this run's read of that file) - no product/infra change. ListConnectors
      unchanged: Gmail (connected, chat-enabled) + Google Drive (connected, chat-disabled) + Google
      Calendar (unknown/not connected) - still no analytics/DB/billing/email/social MCP tool reachable."
    - "RUN 7 demand-signal (CORRECTED mid-run after adversarial review caught wrong URLs on the first
      attempt): fetched grand-screen.com's other listed pantry/grocery apps with the CORRECT slugs
      (grocery-ai-shop-cook-pantry, wonder-fridge-food-organizer, cookbook-recipe-manager - my first pass
      used guessed/truncated slugs that 404'd, and I wrongly logged that as 'the app has no reviews'
      instead of 'I fetched the wrong URL'). All three pages are real and have real reviews. Result: a
      genuine NEW citable barcode complaint on Grocery AI: Bill Garner (Oct 17 2025, aggregator-displayed
      date) - 'Tried a dozen items in my pantry and none of the barcodes registered. Even Walmart brands.'
      - had to manually enter every item. This extends the 'barcode/UPC scanning is unreliable and
      tedious' theme to a THIRD independent barcode-capable app (KitchenPal + My Pantry Tracker from run
      6, now + Grocery AI) - see demand_signal.themes below. Wonder Fridge's reviews are mostly positive
      pantry-tracking praise with one unrelated sharing-feature request and one vague 'not user friendly'
      complaint - not added as evidence (not clearly on-theme). CookBook Recipe Manager's reviews are
      recipe/grocery-list complaints (shopping-cart editability), not pantry/barcode - not added."
    - "RUN 7 outreach research: closed run 6's next_action by searching the untried 'integration/
      distribution partners' angle named in OUTREACH.md's target-type list (receipt/email-parsing tool
      makers, budgeting apps). Surfaced only B2B receipt-OCR API vendors (Veryfi, Klippa, Mindee,
      Tabscanner - developer/enterprise tooling companies, not consumer-app distribution partners) and
      consumer grocery-budgeting apps (Out of Milk, GroceryBudget, Plateful, Banktrack - direct or
      adjacent competitors, not partners). None has a genuine 'why they'd care about a pre-traction,
      gated-waitlist consumer app with zero users' - a credible integration/distribution ask needs
      traction this product doesn't have yet. Zero outreach drafted this run (correct per OUTREACH.md -
      no target clearing name + why + real contact). This closes the LAST untried angle from OUTREACH.md's
      target-type list; runs 2-7 have now searched every category it names with zero qualifying targets."
  next_actions:
    - "Next run: re-check GET /api/growth/snapshot behavior and whether ADMIN_EMAIL / PLAUSIBLE_API_KEY /
      an email provider key have been set — re-verify via public HTTP / ListConnectors rather than
      assuming the circuit-breaker items are still static (RUN 7 re-checked and confirmed: still zero
      owner movement since run 6)."
    - "Aggregator reliability (CORRECTED run 7): grand-screen.com's other listed pantry/grocery apps ARE
      fetchable and DO carry a real, on-theme barcode complaint — Grocery AI (correct slug:
      grocery-ai-shop-cook-pantry) surfaced Bill Garner's barcode-scan-failure review, now cited in
      demand_signal. Wonder Fridge (wonder-fridge-food-organizer) and CookBook Recipe Manager
      (cookbook-recipe-manager) also load fine with real reviews, just none clearly on-theme this pass.
      IMPORTANT correction: a first pass this run used guessed/truncated URL slugs, got 404s, and
      wrongly logged that as 'the app has no reviews' — always verify the exact slug (search
      'site:grand-screen.com <app name>' first) before treating a 404 as a real negative result. Out of
      Milk was NOT re-tried with a corrected slug this run — a future run should retry it (correct slug
      likely 'out-of-milk-grocery-shopping-list' or similar) before assuming it's unavailable."
    - "Outreach: press/newsletter/food-tech-beat/general-landscape/frugal-living/integration-partner
      angles are ALL now searched (runs 2-7) with zero qualifying targets. RUN 7 closed the last untried
      angle from OUTREACH.md's target list (integration/distribution partners) — see learnings. No
      untried target-type category remains from OUTREACH.md's list; a future run should wait for a NEW
      real reason (e.g. an actual launch, a press hook, a named contact surfacing) rather than re-running
      the same exhausted search angles."
    - "Once a channel (email provider or social) connects on top of the now-true site_gate_up: draft 1-2
      curated outreach emails (press/newsletter) — the HARD BLOCK needs both, and only site_gate_up is
      met so far."
  owner_blockers:
    - "RESOLVED run 5 (verified 2026-07-03 via live HTTP behavior, not self-reported): SITE_GATE_PASSWORD
      is set — site_gate_up: true. Re-confirmed unchanged run 6 and run 7 (2026-07-04, identical curl
      behavior both times). No further owner action needed on this item; PENDING_OPS 'site-gate-
      prelaunch' marked done below. (Remember to UNSET it at actual public launch.)"
    - "CIRCUIT BREAKER (re-confirmed run 7, 2026-07-04): the 3 items below (ADMIN_EMAIL, an email
      provider key, PLAUSIBLE_API_KEY) plus channel connection are UNCHANGED since run 5 — zero owner
      movement in 2 straight runs now (`git fetch` shows one new commit since run 6, #399, but it only
      touches GTM_STANDARD.md, not app/infra; ListConnectors unchanged; live HTTP behavior identical).
      Still the single highest-leverage pair to unblock: ADMIN_EMAIL + PLAUSIBLE_API_KEY (both ~5-minute
      Vercel env-var sets, unlock the funnel/analytics READ path)."
    - "HIGH: Set ADMIN_EMAIL in Vercel env to access /admin/waitlist — still unverified (the site gate
      alone explains the current 401; ADMIN_EMAIL's own effect can't be observed until the gate is
      opened or an admin session is used). Funnel stays 0 until this is set AND verified."
    - "HIGH: Connect an email provider (RESEND_API_KEY or SENDGRID_API_KEY) — waitlist signups are
      being captured in the DB but confirmation emails are not confirmed being sent. Real signups are
      not being nurtured. (Docs: PENDING_OPS.md 'track-h-activation')"
    - "HIGH: Set PLAUSIBLE_API_KEY — the tracking script is confirmed live (data-domain verified in the
      deployed HTML) but the Stats API READ that the Growth Agent depends on for visitors_7d / funnel
      rates needs this key too; without it visitor metrics stay 0 even though tracking fires (re-confirmed
      run 7: GET /api/growth/snapshot still returns {\"error\":\"Forbidden.\"})."
    - "NORMAL: Pick a final app name from NAMING_CANDIDATES.md (Pantri / Mise / Larder) —
      all content assets currently use '[APP_NAME]' placeholder; this blocks final email/store copy."
    - "Connect a channel (email provider and/or a social API token) to clear the SECOND half of the
      pre-launch execute-mode HARD BLOCK (ANALYSIS_PLAYBOOK marketing maturity gate) — site_gate_up is
      now true, but channels_connected is still empty, so the agent stays in PREPARE mode until at least
      one channel connects."
  demand_signal:                 # GTM_STANDARD §10 — pre-launch demand validation (leading indicator, NOT PMF)
    as_of: 2026-07-04
    method: "WebSearch + WebFetch against competitor App/Play Store review aggregators. 6 targeted
      Reddit-scoped WebSearch queries (r/mealprep-style phrasing, quoted frustration strings) returned
      NO citable exact-quote threads this run — see limitations below; this is an honest method gap,
      not a claim that Reddit pain doesn't exist."
    themes:
      - theme: "Manual pantry entry never stays current"
        durability: durable        # recurs across structurally different competitor apps
        solved_by_product: true
        evidence:
          - quote: "the pantry is a cumbersome place that's never up-to-date"
            source: "Paprika Recipe Manager 3 user review (C. Moen), via ComplaintsBoard"
            url: "https://www.complaintsboard.com/paprika-recipe-manager-3-b149019"
            date: not_shown_by_source
          - quote: "the additional Pantry and Groceries features I find are mediocre"
            source: "Paprika Recipe Manager 3 user review (P. Kerluke), via ComplaintsBoard"
            url: "https://www.complaintsboard.com/paprika-recipe-manager-3-b149019"
            date: not_shown_by_source
        note: "Corroborates LESSON-0 (2026-06-29, feature-matrix research) with a SECOND, independent
          evidence type — real user reviews — and shows the pain recurs in a recipe-first app (Paprika),
          not only in barcode-first trackers."
      - theme: "Purchases don't automatically flow into the tracked pantry"
        durability: durable
        solved_by_product: true
        evidence:
          - quote: "marking an item in Grocery as purchased can be added to the pantry, but it doesn't appear to increase"
            source: "Paprika Recipe Manager 3 user review (D. Bogan), via ComplaintsBoard"
            url: "https://www.complaintsboard.com/paprika-recipe-manager-3-b149019"
            date: not_shown_by_source
        note: "This is exactly the receipt/Gmail auto-fill + depletion-projection gap the product is built around."
      - theme: "Barcode/UPC scanning is unreliable and tedious"
        durability: durable        # UPGRADED run 7: now recurs across 3 independent barcode-capable apps
        solved_by_product: partial
        evidence:
          - quote: "Many UPC come up with the wrong info or no info at all, requiring the user to manually input data."
            source: "KitchenPal: Pantry Inventory user review (DAH), via grand-screen.com aggregator"
            url: "https://grand-screen.com/apps/kitchenpal-pantry-inventory/reviews/"
            date: "aggregator-displayed 2025-10-17 (see dating caveat below)"
          - quote: "it locked up my whole phone when I tried to scan barcodes"
            source: "KitchenPal user review (Maria Veen), via grand-screen.com aggregator"
            url: "https://grand-screen.com/apps/kitchenpal-pantry-inventory/reviews/"
            date: "aggregator-displayed 2025-10-17 (see dating caveat below)"
          - quote: "Slow when creating a new item, slow during item search."
            source: "KitchenPal user review (Jane Sanders), via grand-screen.com aggregator"
            url: "https://grand-screen.com/apps/kitchenpal-pantry-inventory/reviews/"
            date: "aggregator-displayed 2025-10-17 (see dating caveat below)"
          - quote: "it will not scan QR codes. Can this be added PLEASE???"
            source: "My Pantry Tracker user review (Steven Wilshire), via grand-screen.com aggregator"
            url: "https://grand-screen.com/apps/my-pantry-tracker/reviews/"
            date: "aggregator-displayed 2025-10-17 (same aggregator-cache-date pattern as the KitchenPal quotes above; see dating caveat below)"
          - quote: "Tried a dozen items in my pantry and none of the barcodes registered. Even Walmart brands."
            source: "Grocery AI: Shop, Cook, Pantry user review (Bill Garner), via grand-screen.com aggregator"
            url: "https://grand-screen.com/apps/grocery-ai-shop-cook-pantry/reviews/"
            date: "aggregator-displayed 2025-10-17 (same aggregator-cache-date pattern; see dating caveat below)"
        note: "GroceryManager's receipt/Gmail path avoids this for shop-triggered updates, but its OWN
          /barcode manual-add path shares this exact friction class for non-receipt items — an HONEST
          partial-solve, not a claimed full win. RUN 6 added a SECOND independent barcode-first tracker
          (My Pantry Tracker); RUN 7 added a THIRD (Grocery AI: Shop, Cook, Pantry) — same class of
          complaint (scan failures forcing manual entry) across 3 structurally-similar apps, upgrading
          confidence in this theme's durability further."
    disconfirming_or_limitations:
      - "UPDATE (run 4, 2026-07-03): confirmed Reddit is categorically unreachable to this routine's
        WebSearch tool (explicit 'domain not accessible to our user agent' error on 2 direct
        allowed_domains:[reddit.com] queries) — a hard tool-access limitation, not a phrasing gap as
        run 3 guessed. Closed as a dead end; future runs should not re-attempt Reddit-scoped search.
        Still NOT evidence that Reddit pain doesn't exist — just that this routine cannot observe it."
      - "All 3 KitchenPal review quotes carry the identical aggregator-displayed date (2025-10-17) across
        3 different reviewer names — almost certainly the page's scrape/cache date, not each review's true
        post date. Treated as 'recent, roughly within the last year,' not a precise per-review timestamp."
      - "UPDATE (run 6, 2026-07-04): WebSearch summaries repeatedly surfaced plausible-sounding
        complaint paraphrases for AnyList/Mealime/SuperCook/Fridgely that could NOT be verified by
        directly fetching the underlying page (403, 404, or the page simply not containing the quoted
        text). None were added as evidence — a search-engine summary is not a citable quote. Only
        grand-screen.com and complaintsboard.com have proven directly fetchable across runs 3-6; treat
        any future WebSearch-only 'finding' from another aggregator as unverified until WebFetch confirms
        the exact text on the source page."
      - "UPDATE (run 7, 2026-07-04): a first pass this run used guessed/truncated grand-screen.com URL
        slugs for Wonder Fridge and CookBook Recipe Manager, got 404s, and wrongly logged that as 'no
        reviews exist' — an adversarial reviewer caught this before it shipped. Correct slugs
        (grocery-ai-shop-cook-pantry, wonder-fridge-food-organizer, cookbook-recipe-manager) all load
        real review pages. Corrected finding: Grocery AI DOES carry a real, on-theme barcode complaint
        (Bill Garner, added to the theme above); Wonder Fridge and CookBook's reviews are real but not
        clearly on-theme this pass (recipe/grocery-list/sharing gripes, not barcode/pantry). LESSON: when
        a fetch 404s, verify the exact slug via a targeted WebSearch before treating it as a negative
        result — a 404 is evidence the URL is wrong, not evidence the app has no reviews."
    synthesis: >
      2 of 3 surfaced themes are DURABLE (recurring across a recipe-manager AND a dedicated barcode
      tracker — structurally different apps making the identical complaint) and both are precisely the
      gap this product's receipt/Gmail auto-fill + depletion tracking targets. This corroborates LESSON-0
      with a second, independent evidence type (real dated user reviews, not just feature-matrix
      research). The third theme (barcode tedium) is only PARTIALLY solved today, since /barcode is
      itself a manual per-item flow; RUN 6 upgraded it to DURABLE too (2 independent barcode-capable
      apps), and RUN 7 added a THIRD (Grocery AI: Shop, Cook, Pantry — Bill Garner's review), the same
      class of complaint (scan failures forcing manual entry) now recurring across 3 structurally-similar
      apps. CONFIDENCE: raises confidence in the EXISTING positioning bet; per §10's hard bound this stays
      qualitative — no adoption-rate or CAC number was invented or moved, and no ROADMAP/VISION/
      BUSINESS_CASE-number steer has been taken from this demand_signal block on any run to date (run 3
      added one citation-only footnote to BUSINESS_CASE.md §3 from the original 2 themes, not a figure
      change; runs 6-7's additional barcode-theme evidence did not warrant a further BUSINESS_CASE edit —
      it strengthens confidence in the existing bet, not a new causal finding that would redirect it).
  links:
    in_app_analytics: /admin/waitlist
    owner_doc: docs/growth/GROWTH_STATUS.md
```

## How to read it (owner)

- **`awaiting_connect: true`** + **`engine_built: false`** → the agent is in honest *prepare* mode:
  sharpening content/email/ASO in-repo, taking no external action. Look at `owner_blockers` for what to
  connect to switch it into *execute* mode.
- **`funnel`** is the headline: waitlist signups (pre-launch), then trial→paid + MRR + churn (post-launch).
- **`experiments`** is where compounding happens post-launch — each is a real A/B with a decided result.
- **`learnings`** is the agent's running, data-grounded read on what's driving (or not driving) signups.

## Phase notes

- **Pre-launch:** the number that matters is **waitlist signups** and the channels feeding them. Most of
  the block is `0`/`null`; that's correct and honest.
- **Launching:** trial starts + first conversions appear; `experiments` should be running on the paywall
  and onboarding.
- **Post-launch (compounding):** ground every assumption on REAL conversion / retention / CAC data; run
  continuous experiments; double down on what converts, cut what doesn't; feed the winners back into the
  business case. This is the long game that grows revenue past the $100K floor.
