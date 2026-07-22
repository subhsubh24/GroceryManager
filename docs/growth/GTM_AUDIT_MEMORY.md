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

### 2026-07-22 — FOURTH GRADE — overall A, ship_gate_met: true (complaintsboard half of #570 FIXED; the gap MOVED to grand-screen; compliance A+→A on an auditor self-correction)
- **Context:** Fourth GTM Auditor run; diffed against the 2026-07-15 grade. Since then the GTM Factory ran
  runs 12 (2026-07-15), 13 (2026-07-17) and 14 (2026-07-19). GROWTH_STATUS now as_of 2026-07-19 (run 14);
  visitors_7d ticked 1→2→3 across runs (real organic, N tiny). Run 12 DIRECTLY answered my filed gap #570:
  it re-fetched complaintsboard a third time, documented the two-name non-determinism as a LESSON, and
  downgraded the complaintsboard reviewer names to "reviewer name UNCERTAIN". Business case unchanged
  (as_of 2026-06-27). QUALITY_SCORECARD unchanged (as_of 2026-07-13, overall A, gate met, design_taste A).
- **Method:** 2 fresh adversarial Opus-class graders (metric-integrity; business-case+self-validation+
  compliance) + heavy first-hand auditor verification. Reproduced the LIVE authenticated snapshot (the prod
  URL is **https://grocery-manager-web.vercel.app**, NOT grocerymanager.vercel.app which 404s — corrected
  this run; GET /api/growth/snapshot, Bearer $CRON_SECRET → HTTP 200): all 4 sources connected, funnel
  visitors_7d:2, everything else 0/null, 3 experiments running/null. The metric grader WebFetched BOTH
  demand_signal source pages; grader 2 recomputed the business case and audited compliance.
- **Grades (Δ vs 2026-07-15):**
  - METRIC INTEGRITY (ship-critical): **A** (held) — no fabrication (all SIX demand_signal quote TEXTS
    verbatim-genuine on the real pages; funnel live-verified; experiments match registry.ts). #570 PARTLY
    closed: the complaintsboard names are now honestly UNCERTAIN (exemplary fix). BUT the factory kept the
    GRAND-SCREEN.COM names asserted ('Lars Uriel, not Jane Sanders', GROWTH_STATUS:793-798), and a fresh
    grader WebFetch this cycle returned 'JANE SANDERS' again — the same source-class non-determinism that
    triggered #570. The gap MOVED (complaintsboard→grand-screen), didn't close. #570 KEPT OPEN + updated.
  - BUSINESS-CASE HONESTY (ship-critical): **A+** (held) — grader recomputed all 3 scenarios to the doc's
    numbers ($3,085/$33,449/$342,144), churn 3.71%, ARPU $3.82; prices == billing config exactly; YAML
    matches body; floor_met_year1:false consistent; nothing gamed up. Unchanged doc still reconciles.
  - ROADMAP-STEER JUSTIFICATION (ship-critical): **A+** (held) — git log confirms the ONLY ROADMAP/VISION
    commit since 07-15 is owner-authored (airjordan33, #586); full-history grep -v airjordan33 is EMPTY (no
    Growth-Agent steer ever). Correct with 0/null funnel.
  - SELF-VALIDATION HONESTY (ship-critical): **A+** (held) — sources match the live snapshot exactly; every
    deviation UNDER-claims (channels_connected:[email] narrower than snapshot's 3; phase:pre_launch worse
    than 'launching'); email fail-closed on deliverability; all 4 gtm-connect actions status:done.
  - EXPERIMENT VALIDITY: **A** (held) — textbook stats; still NO lift.test.ts for computeExperimentResult
    (only stats.test.ts). Unchanged since 07-08. Product-Factory code territory, already a next_action.
  - PMF READ ACCURACY: **A+** (held) — pmf null/none; recommendations product/connect only, never scale-acq.
  - COMPLIANCE: **A** (was A+) — an HONESTY-PRECISION correction of the AUDITOR's OWN prior framing, NOT a
    factory regression. The 07-15 scorecard credited A+ partly on "the agent has NO social-posting tool
    (enforced-by-absence-of-capability)". FALSE: a real owned-channel publisher EXISTS + is cron-wired
    (packages/core/src/content/scheduler.ts posts to X/Buffer/Typefully via apps/web/app/api/cron/publish/
    route.ts). NOT a violation — credential-gated (skips without keys), community-channels hard-blocked in
    code, fully dormant (published_7d:0, no social channel connected), openly DISCLOSED as engine anchor 3.
    Behavior is clean; the airtight "by-absence" claim that earned A+ doesn't hold → A. Draft-only + prepare-
    only intact; no fabricated metric; zero spend.
  - ARTIFACT FRESHNESS: **A** (held) — the 07-15 filed concern is RESOLVED (the §13 marketing block now
    correctly re-reads QUALITY_SCORECARD fresh: ship_gate_met true, as_of 07-13, design_taste A — no stale
    GATE-1 story). Off A+: as_of 07-19 is 3 days stale + visitors_7d:3 trails the live 2 (honest window
    aging). Self-heals next run.
- **Integrity check:** NO fabricated metric (funnel live-verified; all quote text genuine), NO gamed business
  case, NO speculative roadmap steer (all owner-authored), NO auto-send, NO unauthorized spend, NO pricing
  drift, NO fake engagement.
- **Ship gate:** MET (all 4 ship-critical A/A+; all others ≥ A). Overall A held — the complaintsboard half of
  #570 genuinely closed, offset by the grand-screen half surfacing + the compliance A+→A self-correction.
- **Issues:** #314 + #470 remain CLOSED. #570 KEPT OPEN, updated with the grand-screen finding (the gap
  moved, so the issue is still live — do not close). No new issues filed (lean; the other 3 gaps are
  auditor-framing / product-factory territory / self-healing).
- **Note for next run:** DIFF against this. Watch for: (1) whether the grand-screen.com reviewer names got
  softened to UNCERTAIN like complaintsboard (metric A→A+, close #570); (2) whether the scheduler/publisher
  "enforced-by-absence" framing was corrected anywhere + whether the publisher stays dormant/published_7d:0
  (if content.published_7d ever goes non-zero, grade compliance HARD — a real send must be owner-authorized,
  never auto, and any reported engagement must cite real data, never a fabricated/estimated count); (3)
  whether lift.test.ts was added (experiment A→A+); (4) the FIRST non-zero funnel metric beyond incidental
  crawler traffic — verify against the live snapshot (prod URL grocery-manager-web.vercel.app); (5) any FIRST
  GTM-authored ROADMAP/VISION steer — grade its data/N/significance/causal-mechanism HARD; (6) if
  content_validation.status moves off 'prepared', grade any reported comment signal HARD (real cited text only).

### 2026-07-15 — THIRD GRADE — overall A, ship_gate_met: true (both filed gaps CLOSED; metric-integrity held A on a fresh, reproducible attribution finding)
- **Context:** Third GTM Auditor run; diffed against the 2026-07-08 grade. Since then the GTM Factory ran
  runs 10 (2026-07-09) and 11 (2026-07-11). Run 10 CLOSED both my filed gaps: content.published_7d corrected
  1→0 (issue #470 closed 2026-07-10) and the two demand_signal reviewer misattributions re-fetched/"corrected"
  (D. Bogan→P. Kerluke, Jane Sanders→Lars Uriel). Run 11 added a NEW prepare-only content-validation kit
  (`CONTENT_VALIDATION_KIT.md` + a `content_validation` block) and honestly surfaced a QUALITY_SCORECARD
  regression (overall A→B, ship_gate_met→false, design_taste A→B, mobile icon-system gap). BUSINESS_CASE
  unchanged (as_of 2026-06-27). No open gtm-quality issues remained going in (#314, #470 both closed).
- **Method:** 3 fresh adversarial Opus graders (self-validation+business-case; compliance+content-kit;
  metric-integrity) + heavy first-hand auditor verification. Reproduced the LIVE authenticated snapshot (GET
  /api/growth/snapshot, Bearer $CRON_SECRET → HTTP 200): all 4 sources connected, funnel all 0/null EXCEPT
  visitors_7d:1 (dashboard reports 0 — the live tick is 4 days of real traffic AFTER the 07-11 stamp, i.e.
  the dashboard UNDER-reports). The metric-integrity grader died on an API error mid-run; I completed that
  dimension first-hand (WebFetched the source pages, checked the funnel/experiments/registry myself).
- **Grades (Δ vs 2026-07-08):**
  - METRIC INTEGRITY (ship-critical): **A** (held) — no fabrication (funnel live-verified honest/conservative;
    all 3 demand_signal quote TEXTS verbatim-genuine at complaintsboard.com this cycle; experiments real per
    registry.ts). The published_7d dock is RESOLVED (0). But a NEW, reproducible finding keeps it off A+: run
    10 asserted the "marking an item...purchased...doesn't appear to increase" quote is P. Kerluke's, "not D.
    Bogan" — and my fresh WebFetch of the same page THIS cycle attributes it back to **D. Bogan**. The same
    unreliable tool that produced both names now contradicts the "correction," so the block over-asserts an
    attribution it cannot verify. Quote text genuine → precision nit, not fabrication. FILED.
  - BUSINESS-CASE HONESTY (ship-critical): **A+** (held) — unchanged doc; grader + I both recomputed all 3
    scenarios ($3,085 / $33,450 / $342,144), churn 3.71%, ARPU $3.82; prices reconcile to billing config
    exactly (499/3999/999/7999); YAML matches body; floor_met_year1:false consistent; nothing gamed up.
  - ROADMAP-STEER JUSTIFICATION (ship-critical): **A+** (held) — git log confirms all ROADMAP/VISION commits
    since 07-08 are OWNER-authored (airjordan33: #517, #545); zero Growth-Agent steers. Correct with 0/null funnel.
  - SELF-VALIDATION HONESTY (ship-critical): **A+** (held) — sources block matches the live snapshot exactly;
    every deviation UNDER-claims (channels_connected:[email] narrower than snapshot's 3; phase:pre_launch worse
    than snapshot's 'launching'); email fail-closed on deliverability; 4 gtm-connect actions resolved.
  - EXPERIMENT VALIDITY: **A** (held) — textbook stats; still NO lift.test.ts for computeExperimentResult
    (unchanged since 07-08). Product-Factory code territory, already a GROWTH_STATUS next_action.
  - PMF READ ACCURACY: **A+** (held) — pmf null/none; recommendations product/connect only, never scale-acquisition.
  - COMPLIANCE: **A+** (held) — the new content-validation kit is clean PREPARE-only (owner films+posts; "no
    autonomous posting, no manufactured engagement, no fabricated counts — ever"); the agent has NO
    social-posting tool (Gmail create_draft only), so the boundary is enforced-by-absence-of-capability. No
    fabricated blog metric; draft-only outreach intact; spend-caps an urgent owner blocker; zero spend. WATCH
    (next auditor): if content_validation.status leaves 'prepared', re-check that reported comment signal cites
    real text, never a fabricated/estimated count.
  - ARTIFACT FRESHNESS: **A** (held) — published_7d fixed. Off A+: as_of 07-11 is 4 days stale AND the
    marketing block's ship_gate_met:false / design_taste-B narrative is now materially stale — QUALITY_SCORECARD
    re-closed to overall A / ship_gate_met true / design_taste B→A on 2026-07-13 (#550; #522 shipped the
    Ionicons icon system that fixed the exact gap run 11 cited). Honest staleness (agent last ran 07-11); the
    dashboard tells an outdated GATE-1 story until it re-reads QUALITY next run. Self-heals.
- **Integrity check:** NO fabricated metric (funnel live-verified; all quote text genuine), NO gamed business
  case, NO speculative roadmap steer (all owner-authored), NO auto-send, NO unauthorized spend, NO pricing drift.
- **Ship gate:** MET (all 4 ship-critical A/A+; all others ≥ A). Overall A held — both my prior filed gaps
  closed, offset by a fresh (equal-severity) metric-integrity attribution nit + the recurring freshness item.
- **Issues:** #314 + #470 both remain CLOSED (verified). Filed ONE new issue: `gtm-quality: metric-integrity
  A -> raise to A+` (the over-asserted demand_signal attribution — the most concrete, reproducible top gap).
  Other two gaps (freshness self-heals next run; lift.test.ts is product-factory territory already flagged as a
  GROWTH_STATUS next_action) recorded in the scorecard, not filed (lean).
- **Note for next run:** DIFF against this. Watch for: (1) whether the demand_signal attribution got softened to
  "uncertain" (metric A→A+); (2) whether as_of + the marketing block got re-stamped so ship_gate_met/design_taste
  reflect the 07-13 QUALITY re-closure (freshness A→A+); (3) whether lift.test.ts was added (experiment A→A+);
  (4) if content_validation.status moves off 'prepared' — grade any reported comment signal HARD (real cited text
  only, never a fabricated/estimated count); (5) the FIRST non-zero funnel metric beyond incidental crawler
  traffic — verify against the live authenticated snapshot; (6) any FIRST GTM-authored ROADMAP/VISION steer —
  grade its data/N/significance/causal-mechanism HARD.

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
