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
<!-- Append one dated entry per run, e.g.:
### 2026-06-27 — pre_launch, awaiting_connect
- Did: tightened the waitlist landing headline against 3 researched competitor angles; refreshed the
  pre-launch email welcome copy. No external action (no channels connected).
- Hypothesis: a benefit-led headline ("never run out, never overbuy") out-pulls the feature-led one.
- Result: not measurable yet (no traffic source connected).
- Decision: staged as the A variant for when channels connect; logged owner_blocker = connect channels.
- Reviewer (maker≠checker): approved — on-brand, no invented metrics, genuinely sharper.
-->
_No runs logged yet._
