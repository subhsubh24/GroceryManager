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
_None yet — promoting from RUN LOG requires ≥2 confirmed data points. First lessons will emerge once channels are connected and real funnel data arrives._

## RUN LOG (newest first)

### 2026-06-27 — pre_launch, awaiting_connect (RUN 1 — FIRST RUN)

**What I did:**
- Full orientation: read all growth/brand/business-case docs. No prior memory.
- Researched competitor landscape for "pantry tracker app" (Grocy, KitchenPal, OurGroceries, AnyList, Foodat, BigOven) via web search. All pricing/feature claims verified or hedged.
- Wrote and added the 4th SEO blog post: `/blog/pantry-tracker-apps` — "Pantry tracker apps: what actually works in 2026" (target keyword: `pantry tracker app`). This was the planned-but-missing Week 4 content calendar item.
- Added "Written by the GroceryManager team" disclosure to the blog post template (FTC-clean; applies to all 4 posts).
- Ran maker≠checker review (independent reviewer subagent) — APPROVED. Improvements applied: KitchenPal barcode claim hedged, CTA made more specific about free vs Premium scope.
- Gates: typecheck ✅, `next build` ✅, no broken re-exports ✅.
- Updated GROWTH_STATUS.md (as_of, learnings, next_actions, owner_blockers).

**Hypothesis:**
A competitive comparison post targeting "pantry tracker app" will capture bottom-of-funnel searchers close to downloading (higher intent than the existing top-of-funnel food-waste and meal-planning posts). Honest comparison including weaknesses builds credibility and trust.

**Result:**
Not measurable — no analytics connected. Zero external action taken (prepare mode).

**Decision:**
Post staged and committed. Monitor keyword ranking once Plausible is connected. If not appearing in search after 60 days, reassess whether to target a longer-tail variant.

**Reviewer verdict:** APPROVED with minor improvements (all applied).

**Operational note:**
No channels are connected. This is the dominant blocker for all growth execution. The circuit breaker is active — if owner_blockers remain identical across 3+ consecutive runs, escalate prominently in the report and stop repeating the same content-sharpening work. The owner must connect at least Plausible before the agent can do meaningful funnel work.

**Competitive findings (carry forward):**
- Foodat ($3.99/mo, $14.99/yr) is the closest receipt-scanning rival. Cheaper than GroceryManager but narrower: no Gmail import, no AI meal gen, no discover feed, no consumption-rate modeling. Honest to recommend for budget-constrained, receipt-scan-only users.
- KitchenPal is free with ads, large barcode DB, family sharing — but manual/barcode-only entry. No run-out prediction. Good for families who want free.
- Grocy: free, self-hosted, most customizable. No receipt scanning. Right for power users; wrong for anyone who wants to be running in 5 minutes.
- OurGroceries: primarily a shared list tool. Shallow on pantry depth. Right choice if the only pain is list coordination.
- GroceryManager differentiator: the only app in the category that does Gmail auto-import + receipt scanning + fridge vision + consumption-rate depletion modeling + AI meal planning + recipe remix + Grocery Wrapped. The full automation loop.
