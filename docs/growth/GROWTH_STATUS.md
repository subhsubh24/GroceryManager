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
  as_of: 2026-06-28
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
  channels: []                   # [{name, status, reach_7d, clicks_7d, signups_7d, ctr, notes}]
  experiments: []                # [{id, hypothesis, status, result, lift_pct, started, decided}]
  email:
    list_size: 0
    double_opt_in: true
    last_stage_sent: null
    open_rate: null
    click_rate: null
  content:
    published_7d: 1              # 4th SEO blog post added today (best-pantry-tracker-apps)
    scheduled_next_7d: 0
    organic_sessions_7d: 0
  learnings:
    - "All funnel metrics are 0/null — no channels connected, no analytics source reporting. Insufficient data for any conversion claim."
    - "4 SEO blog posts now live in /blog (food waste, meal planning, grocery budget, pantry tracker apps). Content calendar Week 1-4 posts all staged."
    - "Growth engine is 100% built but fully dormant — blocked on owner connecting env vars (email provider, cron secret, analytics key). Zero external action taken or possible until site_gate_up is true AND a channel is connected."
  next_actions:
    - "Check if site_gate_up has been flipped to true (owner sets SITE_GATE_PASSWORD in Vercel). If yes + channel connected, enter execute mode."
    - "If still in prepare mode: sharpen WL1 waitlist welcome email subject line — current 'You're on the list' is honest but generic; test a benefit-led subject line variant."
    - "Pull real funnel snapshot from /api/growth/snapshot once CRON_SECRET is set — until then all sources report awaiting_connect."
  owner_blockers:
    - id: set-direct-database-url-prod
      priority: urgent
      detail: "URGENT — signin and signup are BROKEN in production without DIRECT_DATABASE_URL set in Vercel. Set to the Supabase owner/postgres connection (port 5432). See PENDING_OPS.md."
    - id: spend-caps
      priority: urgent
      detail: "URGENT — set hard daily API spend caps in Google Cloud, Twilio, and Anthropic Console before driving any traffic. A single abuse spike can run up real cost."
    - id: site-gate-prelaunch
      priority: high
      detail: "Set SITE_GATE_PASSWORD=deepster in Vercel env to gate the app pre-launch, then set GROWTH_STATUS.site_gate_up: true. This is the HARD precondition for growth execute mode."
    - id: track-h-activation
      priority: high
      detail: "Set CRON_SECRET + an email provider key (RESEND_API_KEY / SENDGRID_API_KEY / POSTMARK_API_KEY) + EMAIL_FROM + EMAIL_UNSUBSCRIBE_SECRET + WAITLIST_OPTIN_SECRET + PLAUSIBLE_API_KEY in Vercel. Full runbook: docs/growth/CONNECT.md."
    - id: connect-channels
      priority: high
      detail: "Connect at least one authorized marketing channel (social API token or email provider) to allow the growth engine to act. Until then: prepare mode only, zero external traffic."
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
