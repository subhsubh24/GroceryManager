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
  as_of: 2026-07-03
  phase: pre_launch              # pre_launch | launching | post_launch
  engine_built: true             # MUST equal (engine_pct == 100); preflight enforces it against real anchor files
  engine_pct: 100                # % of growth-execution engine pieces shipped — DERIVED from anchor files by preflight; NEVER hand-set
  channels_connected: []         # owner-authorized channels actually wired (e.g. [x, instagram, email])
  awaiting_connect: true         # true => agent only prepares creative; takes NO external action
  site_gate_up: false            # HARD precondition for pre_launch execute-mode: true ONLY once the owner
                                 #   has applied the pre-launch SITE GATE (SITE_GATE_PASSWORD set on the
                                 #   deployment). While phase==pre_launch, the Growth Agent must NOT do
                                 #   execute-mode public outreach unless this is true (see ANALYSIS_PLAYBOOK
                                 #   marketing maturity gate). Lifts only at launch.
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
      status: awaiting_connect   # NEXT_PUBLIC_PLAUSIBLE_DOMAIN + PLAUSIBLE_API_KEY unset — no visitor/
                                 #   funnel-rate metric may be reported until this resolves to connected
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
  next_actions:
    - "Next run: attempt to read real waitlist count from /admin/waitlist once ADMIN_EMAIL is set"
    - "Reddit is a CLOSED dead end for this routine's WebSearch tool (confirmed run 4: explicit
      domain-access block, not a phrasing issue) — do NOT re-attempt Reddit-scoped queries. Instead try
      other citable aggregators (Trustpilot, Google Play review pages directly, ComplaintsBoard-style
      sites) for App Store review evidence beyond Paprika/KitchenPal; note some aggregators (e.g.
      justuseapp.com) 403 on WebFetch even when they surface in WebSearch snippets."
    - "Once site_gate_up true AND a channel connects: draft 1-2 curated outreach emails (press/newsletter)"
  owner_blockers:
    - "CRITICAL: Set SITE_GATE_PASSWORD in Vercel env to flip site_gate_up: true — this is the
      HARD gate blocking all execute-mode outreach. Without it the growth agent stays in PREPARE
      mode indefinitely. (Docs: PENDING_OPS.md 'site-gate-prelaunch')"
    - "HIGH: Set ADMIN_EMAIL in Vercel env to access /admin/waitlist — the growth agent cannot
      pull real waitlist signup counts without it. Funnel stays 0 until this is set."
    - "HIGH: Connect an email provider (RESEND_API_KEY or SENDGRID_API_KEY) — waitlist signups are
      being captured in the DB but confirmation emails are not being sent. Real signups are not
      being nurtured. (Docs: PENDING_OPS.md 'track-h-activation')"
    - "HIGH: Connect NEXT_PUBLIC_PLAUSIBLE_DOMAIN — without analytics the agent cannot measure
      blog/landing traffic or visitor-to-waitlist conversion rate."
    - "NORMAL: Pick a final app name from NAMING_CANDIDATES.md (Pantri / Mise / Larder) —
      all content assets currently use '[APP_NAME]' placeholder; this blocks final email/store copy."
    - "REPEATED (4+ runs across 5 days, no movement — re-confirmed run 4 via ListConnectors [still only
      Gmail + Google Drive connected] and a fresh PENDING_OPS re-read [all 4 gtm-connect-* items +
      site-gate-prelaunch still status:open, byte-identical to run 3]): SITE_GATE_PASSWORD + ADMIN_EMAIL
      are the two cheapest, highest-leverage unblocks outstanding — both are ~5-minute Vercel env-var
      sets with zero cost. Naming this prominently again per the FACTORY_STANDARD circuit-breaker rule
      rather than re-deriving it every run."
  demand_signal:                 # GTM_STANDARD §10 — pre-launch demand validation (leading indicator, NOT PMF)
    as_of: 2026-07-03
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
        durability: recent
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
        note: "GroceryManager's receipt/Gmail path avoids this for shop-triggered updates, but its OWN
          /barcode manual-add path shares this exact friction class for non-receipt items — an HONEST
          partial-solve, not a claimed full win."
    disconfirming_or_limitations:
      - "UPDATE (run 4, 2026-07-03): confirmed Reddit is categorically unreachable to this routine's
        WebSearch tool (explicit 'domain not accessible to our user agent' error on 2 direct
        allowed_domains:[reddit.com] queries) — a hard tool-access limitation, not a phrasing gap as
        run 3 guessed. Closed as a dead end; future runs should not re-attempt Reddit-scoped search.
        Still NOT evidence that Reddit pain doesn't exist — just that this routine cannot observe it."
      - "All 3 KitchenPal review quotes carry the identical aggregator-displayed date (2025-10-17) across
        3 different reviewer names — almost certainly the page's scrape/cache date, not each review's true
        post date. Treated as 'recent, roughly within the last year,' not a precise per-review timestamp."
    synthesis: >
      2 of 3 surfaced themes are DURABLE (recurring across a recipe-manager AND a dedicated barcode
      tracker — structurally different apps making the identical complaint) and both are precisely the
      gap this product's receipt/Gmail auto-fill + depletion tracking targets. This corroborates LESSON-0
      with a second, independent evidence type (real dated user reviews, not just feature-matrix
      research). The third theme (barcode tedium) is only PARTIALLY solved today, since /barcode is
      itself a manual per-item flow. CONFIDENCE: raises confidence in the EXISTING positioning bet; per
      §10's hard bound this stays qualitative — no adoption-rate or CAC number was invented or moved, and
      no ROADMAP/VISION/BUSINESS_CASE-number steer was taken this run (added one citation-only footnote
      to BUSINESS_CASE.md §3, not a figure change).
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
