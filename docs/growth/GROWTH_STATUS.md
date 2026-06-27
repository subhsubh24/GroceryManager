# GROWTH STATUS — GroceryManager

The single, machine-readable source of truth for **growth & marketing progress**, owned by the
**Growth Agent** (the daily cloud routine). The factory dashboard reads the fenced `GROWTH_STATUS`
block below — exactly like it reads `BUSINESS_CASE_SUMMARY` in `docs/BUSINESS_CASE.md`. This is how
the owner sees pre-launch / launch / post-launch growth progress in one place.

## Contract (read before editing)

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
- **`phase`** advances `pre_launch` → `launching` → `post_launch`. **Post-launch is the most important
  window** — that's when real conversion/retention/CAC data arrives and the agent compounds it into
  better growth strategy. Keep `learnings` and `experiments` richest here.
- **`as_of`** is stamped every update. A stale `as_of` (the agent didn't run / had nothing real to
  report) is itself a signal — never bump the date without a real reason.

```yaml
GROWTH_STATUS:
  project: GroceryManager
  as_of: 2026-06-27
  phase: pre_launch              # pre_launch | launching | post_launch
  engine_built: true             # Track H growth-execution engine (H1–H8) is live in code (PRs #167–#176)
  channels_connected: []         # owner-authorized channels actually wired (e.g. [x, instagram, email])
  awaiting_connect: true         # true => agent only prepares creative; takes NO external action
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
    published_7d: 1              # 4th SEO blog post added: /blog/pantry-tracker-apps
    scheduled_next_7d: 0
    organic_sessions_7d: 0
  learnings:
    - "All channels still awaiting_connect — zero external signal available. Engine is built; owner activation is the only path to real data."
    - "4th SEO blog post added (pantry tracker comparison, target keyword: pantry tracker app). Bottom-of-funnel content targeting high-intent searchers close to downloading."
    - "Competitive research: Foodat ($3.99/mo) is the closest receipt-scanning rival but lacks Gmail import and AI meal gen. KitchenPal is free but manual-entry-only. Grocy is free/self-hosted but technical. GroceryManager differentiator is the full loop — ingestion + depletion + prediction + meal suggestions."
  next_actions:
    - "Run 2: once owner connects Plausible (NEXT_PUBLIC_PLAUSIBLE_DOMAIN + PLAUSIBLE_API_KEY), pull real visitor and waitlist funnel numbers. Until then, stay in prepare mode."
    - "Run 2: if blog traffic data is available, check whether pantry-tracker-apps post is ranking. If not ranking after 60d, reassess keyword strategy."
    - "Sharpen Product Hunt first-comment copy — the single highest-leverage owned channel for launch-day downloads (top-10 PH = 2,000–10,000 page visits)."
    - "Consider adding a 5th SEO post: 'How to scan grocery receipts and track spending automatically' (target: scan grocery receipts — bottom-funnel, product-specific)."
  owner_blockers:
    - "CIRCUIT BREAKER (run 1): No channels connected. Zero real funnel data. Agent cannot execute externally until at least one channel is wired. See docs/growth/CONNECT.md for the 20-minute activation checklist."
    - "Deploy app to Vercel and set DATABASE_URL — prerequisite for all channel activation."
    - "Connect Plausible (NEXT_PUBLIC_PLAUSIBLE_DOMAIN + PLAUSIBLE_API_KEY) — unlocks visitor + waitlist funnel data."
    - "Connect email provider (RESEND_API_KEY or SENDGRID_API_KEY + EMAIL_FROM + WAITLIST_OPTIN_SECRET) — enables double-opt-in confirmation emails and lifecycle drips."
    - "Set CRON_SECRET — gates both the content publish cron and the growth snapshot API the agent reads each run."
    - "Optional but high-value: connect X/Buffer/Typefully token to enable content scheduler for social posts."
  links:
    in_app_analytics: /admin/waitlist
    owner_doc: docs/growth/GROWTH_STATUS.md
    connect_runbook: docs/growth/CONNECT.md
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
