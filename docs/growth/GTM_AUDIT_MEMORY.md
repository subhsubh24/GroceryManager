# GTM AUDIT MEMORY — GroceryManager

The independent **GTM Auditor's** cross-run memory. The Auditor starts every run COLD (this git repo is
its only memory), so this file is how it grades consistently over time instead of re-deriving the whole
picture each run. Read it FIRST each run, diff the current state vs the last grade, then append.

The Auditor grades the GTM Factory's work (maker ≠ checker) against
[`GTM_RUBRIC.md`](./GTM_RUBRIC.md) and writes [`GTM_SCORECARD.md`](./GTM_SCORECARD.md). The ONLY files it
writes: `GTM_RUBRIC.md`, `GTM_SCORECARD.md`, this file. It NEVER does GTM work or edits growth assets.

## How to maintain it
- **Append one dated entry per run.** Record: overall + per-dimension grades, what CHANGED vs last grade,
  what was verified, any fabrication/gaming/speculative-steer found (or confirmed absent), issues filed.
- Keep it honest and short. A quiet, honest "nothing regressed, still A" entry is a good entry.
- Never inflate. If a grade can't be backed by evidence, grade it LOWER and say why.

## RUN LOG (newest first)

### 2026-07-08 — SECOND GRADE — overall A, ship_gate_met: true (structure improved; metric-integrity slipped A+→A on a nit)
- **Context:** Second GTM Auditor run; diffed against the 2026-07-01 bootstrap grade. Big change since then:
  the GTM Factory ran runs 8-9 and moved from PREPARE (all sources awaiting_connect) to CONNECTED — flipped
  `awaiting_connect` false, `channels_connected` to [email], `site_gate_up` true, added the GTM_STANDARD §4
  `validation:` block + `gtm-connect-*` owner actions (the EXACT gap I filed as #314), added the §13 two-gate
  marketing block, and reports 3 running experiments. Funnel still honestly all 0/null.
- **Method:** 4 fresh adversarial Opus graders (none did the GTM work). **This cycle I also reproduced the
  core claims FIRST-HAND:** `GET /api/growth/snapshot` with `Bearer $CRON_SECRET` (present in the auditor's
  own env) returned HTTP 200 — all 4 sources `connected`, every funnel value 0/null, 3 experiments running/
  null — matching the dashboard EXACTLY. So the run-8/9 "connected" flip is auditor-verified, not maker-asserted.
- **Grades (Δ vs 2026-07-01):**
  - METRIC INTEGRITY (ship-critical): **A** (was A+) — live snapshot funnel independently confirmed all 0/null,
    no fabricated number; demand_signal quote TEXT verbatim-genuine at both URLs. Slipped off A+ on two real
    nits: `content.published_7d:1` has aged past its own 7-day window (post is 9 days old → should be 0) and a
    stale line-213 comment date; plus a possible (uncertain — WebFetch attribution is unreliable) reviewer-name
    mismatch on 2 demand_signal quotes. Accuracy hygiene, NOT fabrication.
  - BUSINESS-CASE HONESTY (ship-critical): **A+** (held) — unchanged doc (as_of 2026-06-27); grader re-recomputed
    all 3 scenarios with arithmetic ($3,085 / $33,450 / $342,144), churn 3.71%, ARPU $3.82, 15% fee — all match;
    YAML matches body; floor_met_year1:false consistent; nothing gamed up. Only sub-cent rounding nits.
  - ROADMAP-STEER JUSTIFICATION (ship-critical): **A+** (was A) — git log confirms all 4 recent ROADMAP/VISION
    commits authored by the OWNER (airjordan33@gmail.com), zero by the Growth Agent; §34/§11/§29 are build items
    banking no adoption %; the demand_signal BUSINESS_CASE touch is citation-only + self-polices. Zero steers is
    correct with a 0/null funnel — exactly what happened.
  - SELF-VALIDATION HONESTY (ship-critical): **A+** (was A) — #314 CLOSED: §4 validation block (GROWTH_STATUS
    :96-125) + gtm-connect-{waitlist,analytics,billing,email} in PENDING_OPS now exist; declared sources match
    the live snapshot exactly; email deliverability caveat fail-closed + disclosed 4x; every deviation UNDER-claims
    (narrower channels + more conservative phase than the API). A+ signature.
  - EXPERIMENT VALIDITY: **A** (held) — real stats (twoProportionZTest/wilson/minSampleSizePerArm); lift.ts gate
    refuses a winner unless both arms ≥ min N AND p<0.05; power-bug guard is real (commit 72adf42, not the 338c5b3
    I cited last cycle — corrected). Gap: computeExperimentResult still has ZERO direct tests (no lift.test.ts).
  - PMF READ ACCURACY: **A+** (was A) — pmf all null/signal:none; recommendations are product/connect fixes only,
    never premature acquisition scaling; no flattery.
  - COMPLIANCE: **A+** (was A) — draft-only hard-enforced; the flagged KitchenPal "large user base" claim is
    REMOVED (posts.ts:255-259); demand_signal quotes carry real URLs + dating caveats + a rejected-paraphrase
    limitations block; spend-caps surfaced as URGENT owner blocker; zero spend.
  - ARTIFACT FRESHNESS: **A** (held) — pricing matches billing config everywhere; §13 gate-file absences
    (MARKETING_HOLD/MARKETING_APPROVED/VALIDATOR_STATUS.md) auditor-verified; [APP_NAME] honestly surfaced. Gap:
    as_of 3 days stale + published_7d aged past its window.
- **Integrity check:** NO fabricated metric (live snapshot confirms funnel 0/null), NO gamed business case, NO
  speculative roadmap steer (all owner-authored build items), NO auto-send, NO unauthorized spend, NO pricing drift.
- **Ship gate:** MET (all 4 ship-critical A/A+; all others ≥ A). Overall A — held vs last cycle, but composition
  shifted: 3 ship-critical dims rose to A+ (self-validation/roadmap gaps closed) while metric-integrity slipped
  A+→A on the windowed-metric nit; net overall unchanged.
- **Issues:** CLOSED #314 (self-validation A→A+) as completed — the §4 block + gtm-connect ids it asked for now
  exist. Filed ONE new issue: `gtm-quality: artifact-freshness A -> raise to A+` (the stale windowed
  published_7d metric — the most concrete, verifiable top gap). Other two top_gaps (lift.test.ts coverage;
  demand_signal attribution re-confirm) recorded in the scorecard, not filed (lean).
- **Note for next run:** DIFF against this. Watch for: (1) whether published_7d/as_of got refreshed (freshness
  A→A+); (2) whether lift.test.ts was added (experiment A→A+); (3) the FIRST non-zero funnel metric once real
  traffic arrives — verify it against the live authenticated snapshot the way I did this run; (4) any FIRST
  GTM-authored ROADMAP/VISION steer — grade its data/N/significance/causal-mechanism HARD; (5) if GATE 1 flips to
  awaiting_approval once VALIDATOR_STATUS.md ships, check the §13 preconditions are genuinely all met, not self-certified.

### 2026-07-01 — BOOTSTRAP + FIRST GRADE — overall A, ship_gate_met: true
- **Context:** First GTM Auditor run. Bootstrapped `GTM_RUBRIC.md` (from the rubric standard, adapted to
  this product) and `GTM_SCORECARD.md` (first real grade — no prior scorecard to diff against). GTM Factory
  is pre-launch, PREPARE mode, no channels connected; funnel honestly 0/null (1 prior Growth Agent run,
  2026-06-29).
- **Method:** 4 fresh, independent, adversarial Opus grader subagents (none did the GTM work), each told to
  REFUTE the GTM Factory's claims and cite file:line/commit evidence.
- **Grades:**
  - METRIC INTEGRITY (ship-critical): **A+** — entire GROWTH_STATUS block 0/null/empty (honest pre-launch);
    only non-zero values are code-derived (engine_pct, preflight-recomputed) or a real staged post. Adversarial
    fabrication hunt confirmed the 19 real app-signups did NOT leak into the funnel as a fake waitlist count.
  - BUSINESS-CASE HONESTY (ship-critical): **A+** — prices reconcile EXACTLY to billing config; summary YAML
    matches body; grader independently recomputed all 3 scenarios + churn + ARPU (all match). Genuinely
    corrected DOWN from a gamed ~$106K to an honest ~$33K base; floor_met_year1:false honest throughout.
  - ROADMAP-STEER JUSTIFICATION (ship-critical): **A** — ZERO GTM-authored ROADMAP/VISION steers (the honest
    correct pre-launch state); the only roadmap edits RETRACT unbacked claims; business case explicitly refuses
    to bank any speculative adoption %. Not A+ only because the §3 discipline has no worked example yet.
  - SELF-VALIDATION HONESTY (ship-critical): **A** — all sources honestly awaiting_connect; no
    claimed-but-unconnected channel; owner_blockers cross-reference open PENDING_OPS ids. Not A+: GTM_STANDARD
    §4 prescribes an explicit `validation:` block + `gtm-connect-<source>` action ids; neither exists (ad-hoc
    ids used). Real STRUCTURAL gap, honesty fully intact — filed as an issue.
  - EXPERIMENT VALIDITY: **A** — experiments:[] honestly empty; sound significance/sample-size code
    (twoProportionZTest/wilsonInterval/minSampleSizePerArm); a real ~10x zFromAlpha power bug was caught WITH
    a regression test (338c5b3). Not A+: apparatus validated only by unit tests, unproven on live exposure data.
  - PMF READ ACCURACY: **A** — pmf all null, signal:none; recommendation is connect/activate, never premature
    acquisition scaling (verified against ANALYSIS_PLAYBOOK gate).
  - COMPLIANCE: **A** — draft-only (drafted_7d:0), PREPARE mode, no external actions; 4th blog post carries no
    invented competitor metrics. Nit: one unsourced 'KitchenPal large user base' qualitative claim.
  - ARTIFACT FRESHNESS: **A** — pricing matches billing config everywhere; [APP_NAME] placeholder + 2-day-stale
    as_of both honestly surfaced, not hidden.
- **Integrity check:** NO fabricated metric, NO gamed business case, NO speculative roadmap steer, NO
  auto-send, NO unauthorized spend, NO pricing drift. This is disciplined, honest pre-launch GTM work.
- **Ship gate:** MET (all 4 ship-critical dims A/A+; all others ≥ A). Overall A (not A+: self-validation §4
  structural gap + several A-level polish items across non-critical dims).
- **Issue filed:** `gtm-quality: self-validation A -> raise to A+` (the single most actionable, standard-
  prescribed gap on a ship-critical dimension; low priority / A→A+ polish). Other two top_gaps
  (experiment coverage test, blog-copy citation) recorded in the scorecard, not filed separately (lean).
- **Note for next run:** DIFF against this. Watch for: (1) any first GTM-authored ROADMAP/VISION steer — grade
  its data/N/significance/causal-mechanism HARD against GTM_STANDARD §3; (2) any first non-zero funnel metric
  once a source connects — verify it against what that source could actually report; (3) whether the §4
  validation block / gtm-connect-* ids got added (self-validation A→A+); (4) as_of freshness.
