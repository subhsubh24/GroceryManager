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
  as_of: 2026-06-29
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
    published_7d: 0
    scheduled_next_7d: 1         # "pantry tracker apps 2026" comparison post staged this run
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
  next_actions:
    - "Next run: attempt to read real waitlist count from /admin/waitlist once ADMIN_EMAIL is set"
    - "Next run: research 2-3 food-tech press/newsletter targets for outreach drafts — stage for
      when site_gate_up flips true"
    - "Next run: check if the 4th blog post ('pantry-tracker-apps-2026') was published (merged to main)"
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
