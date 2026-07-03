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
