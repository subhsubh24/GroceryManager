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
  as_of: 2026-07-05 (run 9)
  phase: pre_launch              # pre_launch | launching | post_launch — NOT "launching" despite the
                                 #   snapshot API's own `phase` field (see below): ANALYSIS_PLAYBOOK's phase
                                 #   definition requires EVERY ship-critical QUALITY_SCORECARD dim A/A+ AND
                                 #   the store live. QUALITY_SCORECARD is A/ship_gate_met (RE-CONFIRMED
                                 #   as_of 2026-07-05, unchanged grade from 2026-07-03), but PENDING_OPS
                                 #   `eas-build-submit-go-live` is still `status: open` — the mobile store
                                 #   submission has NOT happened, so the store isn't live. The snapshot
                                 #   route's `phase` field (see GROWTH_STATUS.sources note) is a narrower
                                 #   code-level signal (stripeConnected && no active subs -> "launching")
                                 #   that does NOT encode store-readiness — do not confuse the two.
  engine_built: true             # MUST equal (engine_pct == 100); preflight enforces it against real anchor files
  engine_pct: 100                # % of growth-execution engine pieces shipped — DERIVED from anchor files by preflight; NEVER hand-set
  channels_connected: [email]    # RE-VERIFIED THIS RUN (run 9) via a FRESH authenticated GET
                                 #   /api/growth/snapshot call (Bearer $CRON_SECRET, again present in this
                                 #   run's environment) — payload identical to run 8's: emailConnected:true (a
                                 #   supported provider key is set). Analytics + billing are real too but are
                                 #   MEASUREMENT/MONETIZATION infra, not marketing "channels" in the
                                 #   ANALYSIS_PLAYBOOK/§9 sense — tracked in `sources` below, not here. (Note:
                                 #   the snapshot route's OWN `channels_connected` field now lists
                                 #   ["analytics","billing","email"] — that is the route's broader code-level
                                 #   definition; this dashboard deliberately keeps the narrower
                                 #   marketing-channel definition established in run 8, unchanged.)
  awaiting_connect: false        # Unchanged since run 8 — both ANALYSIS_PLAYBOOK hard-block preconditions
                                 #   (a real channel connected + site_gate_up true) remain met. Still does NOT
                                 #   mean automated outbound sends start: GTM_STANDARD §6's readiness gate AND
                                 #   the NEW §13 two-gate approval system (added 2026-07-05, PR #441 — see the
                                 #   new `marketing` block below) both keep outbound OFF until the owner
                                 #   explicitly approves GATE 1. What DOES stay open: the agent acts on real
                                 #   (not assumed) funnel/analytics/billing data instead of all-null placeholders.
  site_gate_up: true             # RE-VERIFIED THIS RUN via direct curl: home 200, /signup + /admin/waitlist
                                 #   401 (identical split to runs 5-8) — SITE_GATE_PASSWORD still set, unchanged.
  sources:                       # per-source pull status (H7 snapshot): connected | awaiting_connect —
                                 #   RE-PROBED run 9 (fresh authenticated call, not inferred from run 8):
                                 #   payload identical, all 4 still genuinely connected.
    waitlist: connected          # REAL THIS RUN: the authenticated snapshot (CRON_SECRET, NOT ADMIN_EMAIL)
                                 #   returned a genuine DB-derived total (0) via getWaitlistSubmissions — the
                                 #   routine's OWN read need is satisfied independent of ADMIN_EMAIL, which is
                                 #   a separate, human-UI-only concern (the /admin/waitlist page) — see owner_blockers.
    analytics: connected         # REAL THIS RUN: the route's fetchPlausibleVisitors7d call SUCCEEDED (a live
                                 #   Plausible Stats API round-trip, not just a key-presence check) and returned
                                 #   a real value (0) — PLAUSIBLE_API_KEY + NEXT_PUBLIC_PLAUSIBLE_DOMAIN are both
                                 #   confirmed live and reachable, not merely set.
    billing: connected           # REAL THIS RUN: STRIPE_SECRET_KEY is present AND a real DB query
                                 #   (getActiveSubscriberStats, the preference_signals ledger) executed and
                                 #   returned a genuine count (0 active subscribers) — not a key-presence guess.
                                 #   Whether the Stripe key is TEST or LIVE mode is NOT observable externally;
                                 #   flagged as a next_action to confirm with the owner.
    email: connected             # REAL THIS RUN: a supported provider key (RESEND_API_KEY / SENDGRID_API_KEY /
                                 #   POSTMARK_API_KEY) is present in the deployed app (route-level presence
                                 #   check, per the app's own definition of "connected"). CAVEAT (honest,
                                 #   fail-closed on the UNVERIFIED part): this does NOT itself prove a real
                                 #   email has been delivered — open_rate/click_rate stay null below until a
                                 #   real send+open/click is observed. Key-present != deliverability-proven.
  validation:                    # GTM_STANDARD §4 explicit validation ledger — fail-closed; each
                                 #   unconnected source gets an URGENT gtm-connect-<source> OWNER_ACTION
    waitlist:
      status: connected          # RESOLVED run 8: CRON_SECRET was present in this run's environment for the
                                 #   FIRST time; GET /api/growth/snapshot (Bearer $CRON_SECRET) returned 200
                                 #   with a real DB-derived waitlist total (0). This satisfies the routine's
                                 #   own read need WITHOUT needing ADMIN_EMAIL — ADMIN_EMAIL only gates the
                                 #   human-facing /admin/waitlist UI, tracked separately below.
      owner_action: gtm-connect-waitlist (RESOLVED — see PENDING_OPS)
    analytics:
      status: connected          # RESOLVED run 8: the snapshot route's fetchPlausibleVisitors7d call
                                 #   succeeded (res.ok, real JSON parsed) and returned visitors_7d:0 — a real
                                 #   Plausible Stats API round-trip, not a key-presence guess. Both
                                 #   NEXT_PUBLIC_PLAUSIBLE_DOMAIN (verified run 5) and PLAUSIBLE_API_KEY (new
                                 #   this run) are confirmed live.
      owner_action: gtm-connect-analytics (RESOLVED — see PENDING_OPS)
    billing:
      status: connected          # RESOLVED run 8: STRIPE_SECRET_KEY is present in the deployed app AND
                                 #   getActiveSubscriberStats (a real DB query against the preference_signals
                                 #   ledger) executed and returned a genuine 0-active-subscribers count.
                                 #   Whether the key is Stripe TEST or LIVE mode is not externally observable —
                                 #   flagged in next_actions.
      owner_action: gtm-connect-billing (RESOLVED — see PENDING_OPS)
    email:
      status: connected          # RESOLVED (partial honesty caveat) run 8: a supported provider key
                                 #   (RESEND_API_KEY / SENDGRID_API_KEY / POSTMARK_API_KEY) is present — this
                                 #   is the app's own definition of "connected" (route-level presence check,
                                 #   not a live send). Deliverability itself is UNCONFIRMED: open_rate /
                                 #   click_rate stay null below until a real send + open/click round-trips.
      owner_action: gtm-connect-email (RESOLVED — see PENDING_OPS; deliverability still unverified)
  funnel:                        # REAL numbers, VERIFIED THIS RUN via authenticated GET /api/growth/snapshot
                                 #   (all 4 sources now genuinely connected — see `sources` above). Every
                                 #   value below is a real pull, not an honest placeholder: it happens to be
                                 #   identical to the old placeholder because real traffic is genuinely 0 —
                                 #   correctly so, since this routine has driven zero external traffic to date
                                 #   (still pre_launch / WAITLIST-ONLY) and no owner-side campaign has launched.
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
    cac_usd: null                 # still null: zero spend, zero paid channel approved (§9 Tier B untouched)
    ltv_usd: null                 # still null: zero paid conversions to compute LTV from
    ltv_cac_ratio: null
    top_channel: null              # still null: zero signups from any channel yet
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
  channels:                      # [{name, status, reach_7d, clicks_7d, signups_7d, ctr, notes}]
    - name: email
      status: connected           # REAL, verified run 8 (provider key present; see `sources.email` caveat)
      reach_7d: 0
      clicks_7d: 0
      signups_7d: 0
      ctr: null
      notes: "Provider key connected this run (first observation). list_size is 0 (no confirmed waitlist
        signups yet to mail), and GTM_STANDARD §6's LAUNCH GATE keeps automated lifecycle sends OFF
        regardless of connection until phase==post_launch / an explicit owner launch flag — so zero sends
        this run is CORRECT, not a gap."
  experiments:                   # REAL, VERIFIED THIS RUN — the H10 experiment engine (packages/core/src/
                                 #   growth/experiments) is live in code and the snapshot exposed 3 real,
                                 #   currently-registered experiments. All show status:running / result:null /
                                 #   lift_pct:null because visitors_7d is 0 — zero exposures logged yet, not a
                                 #   fabricated or hidden result. Structure/ids/hypotheses are real (from
                                 #   packages/core/src/growth/experiments), not authored by this routine.
    - id: landing_hero
      hypothesis: "Variant B ('Stop guessing at dinner') and C ('Your kitchen, finally in sync') increase
        waitlist signup rate vs current variant A ('Always know what to cook') by at least 2pp."
      status: running
      result: null
      lift_pct: null
      started: null
      decided: null
    - id: h14_annual_nudge
      hypothesis: "For active monthly subscribers at month 3, leading the nudge with the dollar saving
        ('savings') converts more monthly->annual switches than the routine framing ('control')."
      status: running
      result: null
      lift_pct: null
      started: null
      decided: null
    - id: h15_winback
      hypothesis: "For churned-but-active free users, leading win-back with what Premium adds ('value')
        reactivates more than the warm welcome framing ('control')."
      status: running
      result: null
      lift_pct: null
      started: null
      decided: null
  email:
    list_size: 0                  # real: waitlist_confirmed (0) gated on emailConnected (true) — still 0
                                 #   because zero real confirmed signups exist yet, not because of the gate
    double_opt_in: true
    last_stage_sent: null
    open_rate: null                # UNCONFIRMED per the sources.email caveat — no real send has occurred
    click_rate: null
  content:
    published_7d: 1              # "pantry-tracker-apps-2026" (apps/web/app/blog/posts.ts:223) published
                                  #   2026-06-29 — within the last 7 days as of this run (2026-07-03)
    scheduled_next_7d: 0          # nothing new staged this run (prior value was stale: the run-1 post
                                  #   had already published, so it belonged in published_7d, not here)
    organic_sessions_7d: 0
  outreach:                      # STRATEGIC OUTREACH — curated, human-reviewed Gmail DRAFTS (docs/growth/OUTREACH.md).
                                 #   DRAFT-ONLY: the agent never sends; the OWNER reviews + sends. REAL numbers only.
    drafted_7d: 0                # 0: GTM_STANDARD §6 LAUNCH GATE keeps BOTH outbound lanes fully off until
                                 #   phase==post_launch / an explicit launch flag (still pre_launch) — this
                                 #   is now the operative reason, not site_gate_up (which flipped true in run
                                 #   5). No outreach drafted this run regardless.
    owner_sent_7d: 0             # how many the OWNER actually sent (owner-reported)
    replies_7d: 0                # replies received (OWNER-reported — NEVER fabricated)
    signal: none                 # none | weak | emerging | strong  (0/none pre-launch)
  marketing:                     # GTM_STANDARD §13 — the two-gate autonomous marketing-launch system (added
                                 #   2026-07-05, PR #441; FIRST run this dashboard schema reflects it).
    kill_switch: not_present     # checked FIRST, every run, per §13: docs/growth/MARKETING_HOLD does not
                                 #   exist in this repo (verified via Glob this run) -> not held.
    stage: prepare                # prepare | waitlist (after GATE 1 approval) | launch (after GATE 2)
    gate_1_start_waitlist_outreach:
      status: not_ready           # not_ready | awaiting_approval | approved
      preconditions:
        ship_gate_met: true         # QUALITY_SCORECARD.md as_of 2026-07-05 (independent Quality Auditor):
                                     # overall A, ship_gate_met true, unchanged since 2026-07-03.
        computer_use_e2e_sweep_green: false   # docs/autonomous-loop/VALIDATOR_STATUS.md does NOT exist
                                     # (checked via Glob this run) — the §29 full computer-use E2E sweep has
                                     # never actually RUN. ROADMAP.md:408 still shows this as an unchecked
                                     # Product-Factory build item (epic #413); BROWSERBASE_API_KEY/
                                     # BROWSERBASE_PROJECT_ID are already set + connectivity was proven
                                     # 2026-07-04, so this is NOT an owner blocker — it's un-built product-
                                     # factory work.
        waitlist_launch_assets_reviewed: true  # the waitlist landing page, blog content (4 posts), and email
                                     # lifecycle drafts are shipped and passed the normal maker!=checker PR
                                     # gate; not a fresh pass against this specific §13 checklist, but no
                                     # named gap against them either.
      blocking_precondition: computer_use_e2e_sweep_green
      note: "GATE 1 is NOT proposable this run — 2 of 3 preconditions hold, but the §29 sweep has never
        produced a real VALIDATOR_STATUS.md. Correctly staying quiet rather than proposing early: §13 requires
        ALL THREE, none self-certified. Once the Product Factory ships the sweep GREEN, this flips and the
        Growth Agent should propose the waitlist plan + notify the owner the same run."
    gate_2_launch:
      status: not_ready
      preconditions:
        product_ready: true         # ship_gate_met true, but the STORE is not live (eas-build-submit-go-live
                                     # still open) — ANALYSIS_PLAYBOOK's own phase-advance bar isn't met either.
        validated_demand: false     # waitlist_signups_total is 0 (no outreach has started yet) — no demand
                                     # signal to validate against.
      note: "Not reachable until GATE 1 opens, the waitlist actually gathers real signups, AND the mobile
        store submission (PENDING_OPS eas-build-submit-go-live) completes."
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
    - "RUN 8 (2026-07-04, later cycle) — MAJOR CIRCUIT-BREAKER RESOLUTION: for the FIRST time in 8 runs,
      CRON_SECRET was present in this routine's environment. Called `GET /api/growth/snapshot` with
      `Authorization: Bearer $CRON_SECRET` directly against the live deployed app and got a real HTTP 200
      (every prior run got 403/Forbidden with no CRON_SECRET to send). The payload proves, with real
      round-trip evidence (not key-presence guesses): analytics CONNECTED (Plausible Stats API call
      succeeded, visitors_7d:0 returned), billing CONNECTED (STRIPE_SECRET_KEY present + a real DB query
      returned active_subscribers:0), email CONNECTED (a supported provider key is present — deliverability
      itself still unconfirmed, open/click stay null), and waitlist reads now work via CRON_SECRET
      independent of ADMIN_EMAIL (real total:0). Re-verified via curl that `site_gate_up` is UNCHANGED
      (still true; /signup + /admin/waitlist still 401) — so this is NOT a public launch, it is the owner
      wiring Stripe/Plausible/an email provider into the already-gated app. Also pulled 3 REAL, structurally
      live experiments from the H10 engine (landing_hero, h14_annual_nudge, h15_winback), all status:running
      with null results (0 visitors -> 0 exposures, honestly). Flipped `awaiting_connect` to false and
      `channels_connected` to [email] (email is the one genuine marketing channel among the three; analytics
      + billing are measurement/monetization infra, not outreach channels). Deliberately did NOT flip `phase`
      to 'launching' despite the snapshot route's own narrower phase field saying so — ANALYSIS_PLAYBOOK's
      phase definition requires the STORE to be live too, and PENDING_OPS `eas-build-submit-go-live` is still
      open (mobile submission hasn't happened). Deliberately did NOT start any outbound send or draft any
      new outreach: GTM_STANDARD §6 (added via #399, read fresh this run) keeps BOTH outbound lanes FULLY OFF
      pre-launch regardless of channel connection — a real but narrower unlock (real data instead of
      all-null) than a license to start sending. No demand-signal research this run (prioritized correctly
      verifying + documenting this major infra change over incremental research). Did not touch
      ROADMAP/VISION/BUSINESS_CASE — this is a real-state status refresh, not a new causal finding."
    - "RUN 9 (2026-07-05) — re-verification run + new §13 GATE tracking added; still `pre_launch`, still
      honestly `0`/`null` on funnel/PMF. Re-pulled `GET /api/growth/snapshot` with a fresh `CRON_SECRET`
      (present again this run) and got an IDENTICAL payload to run 8: all 4 sources connected, funnel all
      0/null, the same 3 experiments running with null results. Re-curled the live URL directly: home 200,
      `/signup`+`/admin/waitlist` still 401 — site gate unchanged. `git log` since run 8's merge showed 3 new
      commits, none product/infra: #440 (independent quality re-audit, overall A held, ship_gate_met
      unchanged true), #441 (GTM_STANDARD gained NEW §10 demand-auto-steer language + a NEW §13 two-gate
      autonomous-marketing-launch system), #443 (a ROADMAP item for a future marketing media-gen adapter).
      **Read #441's new §13 in full and added the `marketing` block to this dashboard** (first run reflecting
      it) — checked its 3 GATE-1 preconditions against real evidence: `ship_gate_met` true (QUALITY_SCORECARD
      as_of 2026-07-05), waitlist/launch assets shipped + reviewed (true), but the §29 full computer-use E2E
      sweep has NEVER been run (`docs/autonomous-loop/VALIDATOR_STATUS.md` does not exist — confirmed via
      Glob) — so GATE 1 is honestly `not_ready`, not proposed. This is Product-Factory build work (ROADMAP
      item, epic #413), not an owner blocker (Browserbase keys are already live per ROADMAP.md:408) —
      surfaced as a `next_action` for the product loop to pick up, not an `owner_blocker`. Closed run 7's
      last open demand-signal thread: confirmed via a targeted search that grand-screen.com does not carry
      an Out of Milk review page at all (a real negative, not a guessed-slug 404) — dead end, closing it.
      Checked `MARKETING_HOLD`/`MARKETING_APPROVED` (both absent, as expected pre-approval) via Glob for the
      new `marketing.kill_switch` field. Zero outreach drafted (OUTREACH.md's target-type categories remain
      fully searched with no new qualifying target since run 7; also moot given GATE 1 is not open). No
      ROADMAP/VISION/BUSINESS_CASE steer — no new causal, significant data this run."
  next_actions:
    - "NEW (run 9, highest-leverage GTM-adjacent action): the §29 computer-use E2E sweep
      (docs/autonomous-loop/VALIDATOR_STATUS.md) is the ONLY unmet precondition for GATE 1 (see the new
      `marketing` block above) — it is Product-Factory build work (ROADMAP.md:408, epic #413), not an
      owner action (Browserbase keys are already live). Flagging it here so the product loop (which reads
      GROWTH_STATUS as a data signal per FACTORY_STANDARD §11) sees it is now gating a real GTM milestone,
      not just a nice-to-have validator."
    - "STRIPE_SECRET_KEY mode (test vs live) is not observable from outside the app — ask the owner to
      confirm which mode is live before any business-case revenue claim relies on it (currently moot:
      active_subscribers is 0 either way)."
    - "Email deliverability is UNCONFIRMED (key-presence only) — once GATE 1 opens and the first real
      lifecycle send fires, check for actual delivery (open_rate/click_rate moving off null) before
      trusting the channel for volume."
    - "The single remaining Human-Core blocker to genuine launch is `eas-build-submit-go-live` (mobile
      store submission) — unchanged, still open, across run 8 -> run 9 (see owner_blockers circuit
      breaker). `connect-revenuecat-iap` is the second real launch blocker, also unchanged."
    - "Every run: re-pull `GET /api/growth/snapshot` with the fresh `CRON_SECRET` in this run's env (never
      infer from `git fetch`/`ListConnectors` alone — FACTORY_STANDARD §28) and re-verify site_gate_up via
      direct curl. RUN 9 did both: payload identical to run 8 (all 4 sources connected, funnel still all
      0/null); site gate still up."
    - "Aggregator reliability (CORRECTED run 7): grand-screen.com's other listed pantry/grocery apps ARE
      fetchable and DO carry a real, on-theme barcode complaint — Grocery AI (correct slug:
      grocery-ai-shop-cook-pantry) surfaced Bill Garner's barcode-scan-failure review, now cited in
      demand_signal. Wonder Fridge (wonder-fridge-food-organizer) and CookBook Recipe Manager
      (cookbook-recipe-manager) also load fine with real reviews, just none clearly on-theme this pass.
      IMPORTANT correction: a first pass this run used guessed/truncated URL slugs, got 404s, and
      wrongly logged that as 'the app has no reviews' — always verify the exact slug (search
      'site:grand-screen.com <app name>' first) before treating a 404 as a real negative result. CLOSED
      run 9: a targeted 'site:grand-screen.com out of milk grocery shopping list reviews' search returned
      the aggregator's real indexed app list (AnyList, Our Groceries, My Pantry Tracker, My H-E-B,
      AppSales) with no Out of Milk page anywhere in it — a genuine negative result (the aggregator does
      not carry this app), not a guessed-slug 404. Do not re-attempt Out of Milk on grand-screen.com."
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
    - "CIRCUIT BREAKER (now 2 runs / 1 day, 2026-07-04 -> 2026-07-05, zero movement on the Human-Core items
      below): site_gate_up, analytics/billing/email connection, and the QUALITY_SCORECARD ship gate are all
      RESOLVED and STABLE (re-verified run 9 via a fresh authenticated snapshot pull + a fresh live-HTTP
      curl — see `sources`/`funnel` above). What has NOT moved since run 8, confirmed still `status: open` in
      PENDING_OPS this run: `eas-build-submit-go-live` (mobile store submission), `connect-revenuecat-iap`
      (mobile IAP), `spend-caps` (urgent), `turnstile-keys` (blocks launch-safety), `rotate-envl-secrets`. Per
      FACTORY brakes, naming this prominently: the single highest-leverage pair is `eas-build-submit-go-live`
      + `connect-revenuecat-iap` — both are the ONLY remaining blockers to the store going live, which is
      itself the ONLY remaining blocker to `phase` advancing past `pre_launch`."
    - "HIGH: `eas-build-submit-go-live` (mobile store submission, Human-Core) — until this completes, the
      store isn't live (ANALYSIS_PLAYBOOK's own phase-advance criterion) and GTM_STANDARD §13 GATE 2 stays
      unreachable regardless of GATE 1's outcome."
    - "HIGH: `connect-revenuecat-iap` (mobile in-app-purchase activation, Human-Core) — the purchase flow +
      webhook code is built (PR #266); only the RevenueCat dashboard config + live SDK keys are missing. An
      App-Store-targeted launch cannot accept payment on device without this."
    - "URGENT (unchanged since run 8): `spend-caps` — Stripe/Plausible/email keys are now confirmed LIVE in
      the deployed app, so real paid surfaces are active; still no owner-set hard daily spend cap/alert on
      any provider dashboard. This routine cannot set spend caps itself."
    - "HIGH (unchanged): `turnstile-keys` — Cloudflare Turnstile site + both env keys still unset; captcha
      fail-opens per §32 (signup is never hard-blocked) but is unprotected against bot abuse until set."
    - "NORMAL (unchanged): Pick a final app name from NAMING_CANDIDATES.md (Pantri / Mise / Larder) — all
      content assets still use the '[APP_NAME]' placeholder; blocks finalizing store/email copy."
    - "LOW (unchanged since run 8): ADMIN_EMAIL — only gates the human `/admin/waitlist` UI page; the Growth
      Agent's own analytics read need is already satisfied via CRON_SECRET."
  demand_signal:                 # GTM_STANDARD §10 — pre-launch demand validation (leading indicator, NOT PMF)
    as_of: 2026-07-05
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
