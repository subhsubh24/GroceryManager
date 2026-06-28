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
_None yet — the first runs will establish these. Promote a RUN LOG finding here once it's confirmed._

## RUN LOG (newest first)

### 2026-06-28 — pre_launch, awaiting_connect, site_gate_up: false
- **State:** Engine 100% built. No channels connected. site_gate_up: false → PREPARE mode only. No external action taken or possible.
- **Did:** Added the 4th SEO blog post ("Pantry tracker apps: what actually works in 2026", slug: best-pantry-tracker-apps) to `/blog`. This was the planned Week 4 content calendar item (target keyword: "pantry tracker app", competitor-comparison intent) that was missing. Written as educational first, promotional second — no fabricated competitor names, no invented metrics. Reviewed by independent subagent: APPROVED (one flag resolved: "Free to start" CTA verified against real free tier in billing module).
- **Hypothesis:** A feature-comparison post targeting "pantry tracker app" (mid-to-bottom funnel, high purchase intent) will attract organic visitors actively evaluating options — GroceryManager's differentiators (receipt import, depletion modeling, cook-from-pantry) map directly to what this audience is looking for.
- **Result:** Not measurable — no analytics source connected, no traffic. Plausible tracking script is scaffolded but PLAUSIBLE_API_KEY not set; organic_sessions_7d = 0.
- **Decision:** Post staged (it's in the repo and will be live once deployed). Will measure organic sessions once Plausible is connected.
- **Owner blockers identified this run:** (1) URGENT: DIRECT_DATABASE_URL missing → auth broken in prod. (2) URGENT: spend caps not set. (3) HIGH: SITE_GATE_PASSWORD not set → site_gate_up false → cannot enter execute mode. (4) HIGH: Track H env vars (email/cron/analytics) not set → growth engine fully dormant.
- **Next run priority:** Check if site_gate_up has been flipped. If still false: sharpen WL1 waitlist welcome email subject line (current "You're on the list" is generic; test a benefit-led variant).
