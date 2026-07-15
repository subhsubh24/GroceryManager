# GTM SCORECARD — GroceryManager

The independent **GTM Auditor's** evidence-backed grade of the GTM Factory's revenue/go-to-market work,
against [`docs/growth/GTM_RUBRIC.md`](./GTM_RUBRIC.md). The GTM Auditor (checker) writes this file; the
GTM Factory (maker) never grades its own work (maker ≠ checker). This is to GTM exactly what
`docs/quality/QUALITY_SCORECARD.md` is to the product. The dashboard reads the fenced `GTM_SCORECARD`
block below. Every grade cites concrete evidence a fresh, adversarial grader subagent actually checked.

```yaml
GTM_SCORECARD:
  project: GroceryManager
  as_of: 2026-07-15
  overall: A
  ship_gate_met: true            # true ONLY when every ship_critical dim is A/A+ AND all others >= B
  phase_context: pre_launch      # sources CONNECTED (runs 8-11); store not live (eas-build-submit-go-live
                                 #   still open). GTM Factory's own dashboard is as_of 2026-07-11 (run 11);
                                 #   funnel honestly ~0/null — auditor re-verified against the live snapshot.
  method: "3 fresh, independent, adversarial grader subagents (Opus) + first-hand auditor verification.
           None did the GTM work. The auditor reproduced the live claims directly: an authenticated GET
           /api/growth/snapshot (Bearer $CRON_SECRET, present in the auditor's env) returned HTTP 200 with
           all 4 sources 'connected' and the funnel all 0/null except visitors_7d:1 (the dashboard's run-11
           value is 0 — the live tick to 1 is 4 days of real traffic AFTER the 07-11 stamp, i.e. the
           dashboard under-reports). The auditor also WebFetched the demand_signal source pages, recomputed
           the business case, and confirmed ROADMAP/VISION authorship via git log. The metric-integrity
           grader died on an API error mid-run; the auditor completed that dimension first-hand."
  dimensions:
    metric_integrity:
      grade: A
      ship_critical: true
      evidence: >
        Auditor INDEPENDENTLY reproduced the live authenticated snapshot (GET /api/growth/snapshot, Bearer
        $CRON_SECRET → HTTP 200): funnel visitors_7d:1 (dashboard reports 0 — real traffic ticked up AFTER
        the 07-11 stamp, so the dashboard UNDER-reports, the honest direction), waitlist_signups_total:0,
        active_subscribers:0, mrr_usd:0, trial_to_paid_rate:null; 3 experiments landing_hero/h14/h15 all
        running/null — matching packages/core/src/growth/experiments/registry.ts (real ids, not invented).
        NO fabricated number anywhere → nowhere near F. The two 2026-07-08 docks are addressed: (a)
        content.published_7d corrected 1→0 in run 10 (apps/web/app/blog/posts.ts newest post 2026-06-29 is
        >7 days old — verified; issue #470 CLOSED); (b) the demand_signal reviewer attributions were
        re-fetched and "corrected" in run 10. Auditor WebFetched complaintsboard.com/paprika-recipe-manager-3
        this cycle: all three quote TEXTS are verbatim-genuine on the real page — quote integrity intact.
      gap: "Off A+: the demand_signal reviewer ATTRIBUTION is asserted as a settled correction it cannot
            verify. Run 10 declared the 'marking an item...purchased...doesn't appear to increase' quote is
            P. Kerluke's, 'not D. Bogan'. A fresh auditor WebFetch of the same page THIS cycle attributes
            that quote back to D. Bogan — the same unreliable tool that produced both names now contradicts
            the correction. The quote TEXT and URL are genuine (not fabrication), but the block over-states
            attribution certainty. FIX: mark the reviewer name uncertain (aggregator page; WebFetch
            name-extraction is documented-unreliable) rather than asserting a specific corrected name."
    business_case_honesty:
      grade: A+
      ship_critical: true
      evidence: >
        Adversarial grader + auditor both recomputed. Prices reconcile EXACTLY: billing config
        (packages/core/src/billing/index.ts:43,59,69,70 → 499/3999 monthly/annual, family 999/7999) ==
        BUSINESS_CASE.md:44-46 ($4.99/$39.99, family $9.99/$79.99). All 3 scenarios recompute: conservative
        500×0.35×0.025÷0.065×$3.82×12 = $3,085≈$3,100; base $33,450 exact; optimistic
        6000×0.55×0.06÷0.030×$4.32×12 = $342,144≈$342,000. Blended churn 3.71%, ARPU $3.82. Summary YAML
        (:8-13) matches the body scenarios; floor_met_year1:false consistent at :13,:218,:240,:248,:344.
        Nothing gamed UP — base is ~1/3 of the $100K floor, and the doc self-documents rolling a prior gamed
        ~$106K down to the honest ~$33K. Doc unchanged since 2026-06-27; still reconciles.
      gap: null
    roadmap_steer_justification:
      grade: A+
      ship_critical: true
      evidence: >
        Zero GTM-authored ROADMAP/VISION steers. git log --format='%ae' -- ROADMAP.md VISION.md since
        2026-07-08 returns only airjordan33@gmail.com (the OWNER) commits (#517 LaunchGuard auth fix,
        #545 bookkeeping) — none by the Growth Agent. With the funnel all 0/null (live-verified), zero
        steers is the correct answer and it is exactly what happened. No adoption %/conversion figure was
        banked from the demand_signal or the new content-validation work into any roadmap/vision/business
        figure (both self-police that they change no modelled number).
      gap: null
    self_validation_honesty:
      grade: A+
      ship_critical: true
      evidence: >
        Adversarial grader confirmed: GROWTH_STATUS sources (:82,:86,:90,:95, all 'connected') MATCH the
        auditor's live authenticated snapshot EXACTLY — no claimed-but-unconnected channel (the F trigger)
        exists. Every deviation UNDER-claims: dashboard channels_connected:[email] is narrower than the
        snapshot's [analytics,billing,email] (analytics/billing tracked truthfully as measurement infra, not
        marketing channels), and dashboard phase:pre_launch is worse-sounding than the snapshot's 'launching'
        — reporting a more conservative state than the API is the A+ signature. Email 'connected' is
        fail-closed on deliverability (open_rate/click_rate null; key-presence != delivery-proven), disclosed
        4x. All 4 gtm-connect-{waitlist,analytics,billing,email} owner actions resolved (PENDING_OPS
        :47,:59,:69,:80, status:done). Filed gap #314 stays CLOSED.
      gap: null
    experiment_validity:
      grade: A
      ship_critical: false
      evidence: >
        Real, textbook stats: stats.ts twoProportionZTest (pooled two-tailed p, significant iff p<0.05),
        wilsonInterval, minSamplePerArm; lift.ts computeExperimentResult declares 'decided' ONLY when both
        arms exceed min N AND test.significant, else 'running' with null lift/CI — codified insufficient-data
        honesty. 3 hypotheses falsifiable with explicit MDEs (+2pp), all honestly running/null at 0 exposures
        (live snapshot confirms). No p-hacking; no result claimed on zero data.
      gap: "Raise to A+: computeExperimentResult (packages/core/src/growth/experiments/lift.ts) — the actual
            decided-vs-running monetization gate — STILL has ZERO direct tests (only stats.test.ts exists; no
            lift.test.ts). Unchanged since 2026-07-08. Product-Factory code territory (already a GROWTH_STATUS
            next_action); add a lift.test.ts asserting 'running' at sub-N/non-significant and 'decided' only
            on sufficient+significant."
    pmf_read_accuracy:
      grade: A+
      ship_critical: false
      evidence: >
        pmf block (GROWTH_STATUS.md:153-165) fully null with signal:none — the correct pre-data read.
        next_actions point EXCLUSIVELY at product/infra/connect fixes (§29 sweep, eas-build-submit-go-live,
        the owner-executes content-validation kit), never 'scale acquisition'; acquisition.cac/ltv/ratio/
        top_channel all null (zero spend). No flattery — no claimed PMF signal unbacked by cohort data.
      gap: null
    compliance:
      grade: A+
      ship_critical: false
      evidence: >
        Adversarial grader found ZERO current violations. The NEW run-11 content-validation surface
        (docs/growth/CONTENT_VALIDATION_KIT.md + the content_validation block) is strictly PREPARE-only:
        "the OWNER films the reaction cut and posts it. No autonomous posting, no manufactured engagement,
        no fabricated comment/view counts — ever" (kit :3-6, hard boundaries :104-110); comment_signal:none
        "never inferred from view count alone"; every CTA points at the public waitlist, not the gated app.
        The agent has NO social-posting tool (Gmail create_draft only), so the prepare-only boundary is
        enforced-by-absence-of-capability, not just doctrine. Outreach draft-only intact (OUTREACH.md:5,
        drafted/sent/replies all 0). Blog carries no fabricated competitor metric (grep for star/rating/
        millions/user-count = zero; the removed KitchenPal 'large user base' claim stays removed).
        demand_signal quotes carry real URLs + dating caveats + a limitations block treating fetched content
        as data. spend-caps surfaced as an URGENT owner blocker; cac_usd null (zero spend).
      gap: null
    artifact_freshness:
      grade: A
      ship_critical: false
      evidence: >
        Pricing consistent with billing config everywhere (BUSINESS_CASE + upgrade page all == config).
        content.published_7d corrected to 0 (the 2026-07-08 filed gap #470 — CLOSED 2026-07-10). §13
        marketing/kill-switch fields auditor-verified against disk (MARKETING_HOLD absent).
      gap: "Raise to A+: (1) as_of 2026-07-11 (run 11) is 4 days stale vs today. (2) More substantively, the
            marketing block's ship_gate_met:false + 'design_taste B / mobile icon-system gap' narrative is now
            MATERIALLY STALE — QUALITY_SCORECARD re-closed to overall A / ship_gate_met true / design_taste
            B→A on 2026-07-13 (#550; #522 added the Ionicons icon system that fixed the exact gap run 11
            cited). Honest staleness (the agent last ran 07-11, before the 07-13 fix), but the dashboard
            currently tells an outdated GATE-1 story. Re-stamp as_of + re-read the QUALITY_SCORECARD on the
            next run so the marketing block reflects the recovered ship gate. Self-heals on next run."
  top_gaps:                        # ordered by severity; none blocks the gate (all A/A+ ship-critical, others >= A)
    - dimension: metric_integrity
      severity: low
      ship_critical: true
      gap: "The demand_signal reviewer ATTRIBUTION is asserted as a settled run-10 correction (P. Kerluke,
            'not D. Bogan') that a fresh auditor WebFetch this cycle CONTRADICTS (same page → D. Bogan). The
            quote TEXT is verbatim-genuine (not fabrication) but the block over-states attribution certainty.
            Mark the reviewer name uncertain (WebFetch name-extraction is documented-unreliable) instead of
            asserting a specific corrected name."
      filed_issue: "gtm-quality: metric-integrity A -> raise to A+ (over-asserted demand_signal attribution)"
    - dimension: artifact_freshness
      severity: low
      ship_critical: false
      gap: "as_of 2026-07-11 is 4 days stale; the marketing block's ship_gate_met:false / design_taste-B
            narrative is now stale (QUALITY re-closed to A / gate met / design_taste A on 2026-07-13). Re-stamp
            + re-read QUALITY_SCORECARD next run. Self-heals on next run — recorded, not separately filed."
    - dimension: experiment_validity
      severity: low
      ship_critical: false
      gap: "computeExperimentResult (lift.ts) — the decided-vs-running monetization gate — still has zero
            direct tests. Add a lift.test.ts. Product-Factory code territory; already a GROWTH_STATUS
            next_action — recorded, not separately filed."
  summary: >
    Disciplined, honest GTM work that CLOSED both 2026-07-08 filed gaps (issue #314 self-validation stays
    closed; issue #470 artifact-freshness CLOSED — content.published_7d corrected 1→0, reviewer misattributions
    re-fetched in run 10). The auditor independently reproduced the live authenticated snapshot: all 4 sources
    'connected', funnel all 0/null except a single real visitor the dashboard under-reports — no fabrication,
    no flattery. Three ship-critical dimensions are A+ (business-case reconciles exactly, zero GTM-authored
    roadmap steers, self-validation matches the live snapshot and under-claims). Metric integrity holds at A:
    the run-10 demand_signal attribution "correction" is itself contradicted by a fresh WebFetch this cycle
    (the same unreliable tool now names D. Bogan again), so the block over-asserts an attribution it cannot
    verify — quote text genuine, so a precision nit, not fabrication. The new run-11 content-validation kit is
    a clean, prepare-only asset with no auto-post/fake-engagement/fabricated-metric (compliance A+). No gamed
    business case, no speculative roadmap steer, no auto-send, no unauthorized spend, no pricing drift. Ship
    gate MET on GTM quality. NOTE: this grades the GTM WORK's honesty/quality — independent of the product's
    own launch readiness (see QUALITY_SCORECARD, which re-closed its own ship gate on 2026-07-13).
```

## How to read it (owner)

- **`overall` + `ship_gate_met`** are the headline. `ship_gate_met: true` means the GTM Factory's work
  cleared the honesty/quality bar (every ship-critical dimension A/A+, all others ≥ B).
- **`dimensions`** — each grade is backed by evidence a fresh adversarial grader and/or the auditor
  actually verified (live snapshot, recomputed business case, git authorship, WebFetched sources).
- **`top_gaps`** — ordered improvements the GTM Factory should close; the top gap is filed as a
  `gtm-quality:` issue. This cycle nothing is below A; all three gaps are A→A+ polish.
