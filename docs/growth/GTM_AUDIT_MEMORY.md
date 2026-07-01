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
