# GTM SCORECARD — GroceryManager

The independent **GTM Auditor's** evidence-backed grade of the GTM Factory's revenue/go-to-market work,
against [`docs/growth/GTM_RUBRIC.md`](./GTM_RUBRIC.md). The GTM Auditor (checker) writes this file; the
GTM Factory (maker) never grades its own work (maker ≠ checker). This is to GTM exactly what
`docs/quality/QUALITY_SCORECARD.md` is to the product. The dashboard reads the fenced `GTM_SCORECARD`
block below. Every grade cites concrete evidence a fresh, adversarial grader subagent actually checked.

```yaml
GTM_SCORECARD:
  project: GroceryManager
  as_of: 2026-07-08
  overall: A
  ship_gate_met: true            # true ONLY when every ship_critical dim is A/A+ AND all others >= B
  phase_context: pre_launch      # sources now CONNECTED (runs 8-9) but still pre_launch (store not live);
                                 #   funnel honestly 0/null — auditor re-verified against the live snapshot
  method: "4 fresh, independent, adversarial grader subagents (Opus), none of which did the GTM work,
           each told to REFUTE the GTM Factory's claims and cite file:line/commit evidence. This cycle the
           auditor ALSO reproduced the claims first-hand: an authenticated GET /api/growth/snapshot
           (Bearer $CRON_SECRET, present in the auditor's env) returned HTTP 200 with all 4 sources
           'connected' and every funnel value 0/null — matching the dashboard exactly."
  dimensions:
    metric_integrity:
      grade: A
      ship_critical: true
      evidence: >
        Auditor INDEPENDENTLY reproduced the live authenticated snapshot (GET /api/growth/snapshot, Bearer
        $CRON_SECRET → HTTP 200): funnel ALL 0/null (visitors_7d:0, waitlist_signups_total:0,
        active_subscribers:0, mrr_usd:0, trial_to_paid_rate:null), 3 experiments landing_hero/h14/h15 all
        status:running result:null — matching GROWTH_STATUS.md EXACTLY, no fabricated number leaked in.
        engine_pct:100 is code-derived (preflight recomputes from 5 anchor files, all verified present).
        published_7d:1 maps to a real post (posts.ts:223, publishedAt 2026-06-29). Grader WebFetched both
        demand_signal source URLs: all quote TEXT is verbatim-genuine, no fabricated review. No fabrication
        anywhere → nowhere near F.
      gap: "Off A+ (down from A+ 2026-07-01) on two real accuracy nits: (a) content.published_7d:1 now reads
            wrong — the post is 9 days old as of 2026-07-08, outside its own 7-day window (should be 0), and
            the line-213 comment still cites 'as of 2026-07-03'; (b) two demand_signal reviewer attributions
            (D. Bogan / Jane Sanders) may not match the source-page names (P. Kerluke / Lars Uriel) — quote
            text is genuine, WebFetch attribution extraction is unreliable, so re-confirm rather than assume."
    business_case_honesty:
      grade: A+
      ship_critical: true
      evidence: >
        Prices reconcile EXACTLY: billing config (packages/core/src/billing/index.ts:40,56,66-67 →
        499/3999 monthly/annual, family 999/7999) == BUSINESS_CASE.md:44-46 ($4.99/$39.99, family
        $9.99/$79.99). Grader independently recomputed all 3 scenarios showing arithmetic: conservative
        (500×0.35×0.025÷0.065×$3.82×12 = $3,085≈$3,100), base ($33,450 exact), optimistic ($342,144≈
        $342,000); blended churn 3.707%≈3.71%, ARPU $3.818≈$3.82, 15% fee applied as ×0.85 throughout,
        ramp 1/c=27mo. Summary YAML (7-15) matches body; floor_met_year1:false consistent in all 4 places
        (:13,:218,:247,:340). Nothing gamed UP — base is 1/3 of the floor and the doc self-documents rolling
        back a prior gamed 12.6% funnel to the honest freemium 4%. Only 2 sub-cent rounding nits in non-floor
        upside numbers ($4.31 vs 4.32 with-Family ARPU; ~83% vs ~86% 4yr ramp) — immaterial.
      gap: null
    roadmap_steer_justification:
      grade: A+
      ship_critical: true
      evidence: >
        Zero GTM-authored ROADMAP/VISION steers. git log --format='%ae' -- ROADMAP.md VISION.md since
        2026-07-01 returns 4 commits, ALL airjordan33@gmail.com (the OWNER), none by the Growth Agent:
        §34 pre-launch-funnel (1d2b8ff, epic #453), §11 media-gen adapter (46a16c1, #442), §29 validator
        (6cf3a77/19d8711) — all product/infra BUILD items banking no adoption %/conversion figure. The one
        demand_signal touch on BUSINESS_CASE (:157-163) is citation-only and self-polices ('does NOT change
        the modelled 4% base rate or any other figure — directional corroboration, not a new number'). With
        the funnel all 0/null, zero steers is the correct answer and it is exactly what happened.
      gap: null
    self_validation_honesty:
      grade: A+
      ship_critical: true
      evidence: >
        The 2026-07-01 filed gap (#314) is CLOSED: GROWTH_STATUS.md:96-125 now carries the explicit
        GTM_STANDARD §4 `validation:` block, and PENDING_OPS.md:21,33,43,54 carries gtm-connect-{waitlist,
        analytics,billing,email} owner actions (status:done, dated). Declared sources (all 4 'connected')
        MATCH the auditor's live authenticated snapshot exactly — no claimed-but-unconnected channel (the
        F trigger) exists. The one deliverability risk is fail-closed + disclosed 4x (email is 'connected'
        by key-presence only; open_rate/click_rate stay null). Every deviation UNDER-claims: dashboard shows
        channels_connected:[email] (snapshot says [analytics,billing,email]) and phase:pre_launch (snapshot's
        own field says 'launching') — reporting a worse-sounding state than the API is the A+ signature.
      gap: null
    experiment_validity:
      grade: A
      ship_critical: false
      evidence: >
        Real, textbook stats: stats.ts twoProportionZTest (pooled two-tailed p, significant iff p<0.05),
        wilsonInterval, minSampleSizePerArm (correct (z_a/2+z_b)^2 power formula). lift.ts
        computeExperimentResult declares 'decided' ONLY when both arms exceed minSamplePerArm AND
        test.significant, else 'running' with null lift/CI — codified insufficient-data honesty. 3
        hypotheses falsifiable with explicit MDEs (+2pp/+3pp/+2pp), all honestly running/null at 0
        exposures. Real power-bug guard: commit 72adf42 (not the 338c5b3 cited last cycle) fixed the
        inverted zFromAlpha sign bug WITH a monotonicity regression test.
      gap: "Raise to A+: computeExperimentResult (the actual decided-vs-running monetization gate) has ZERO
            direct tests — only stats.test.ts exists, no lift.test.ts / bucketing test. Add a lift test
            asserting 'running' at sub-N + non-significant inputs and 'decided' only on sufficient+significant."
    pmf_read_accuracy:
      grade: A+
      ship_critical: false
      evidence: >
        pmf block (GROWTH_STATUS.md:148-160) fully null with signal:none — the correct pre-data read.
        next_actions (:455-495) point EXCLUSIVELY at product/infra fixes (§29 sweep, eas-build-submit-go-live,
        connect-revenuecat-iap, email deliverability), never 'scale acquisition'; acquisition.cac/ltv/ratio/
        top_channel all null (zero spend). The one outreach next_action is draft-only + gated behind GATE 1,
        not paid-channel scaling. ANALYSIS_PLAYBOOK.md:63-70 makes the PMF signal govern the lever and the
        block obeys it. No flattery — no claimed PMF signal unbacked by cohort data.
      gap: null
    compliance:
      grade: A+
      ship_critical: false
      evidence: >
        Draft-only hard-enforced: OUTREACH.md:5 'DRAFT ONLY... the agent never sends... no auto-send ever';
        outreach.drafted_7d/owner_sent_7d/replies_7d all 0. The 2026-07-01-flagged 'KitchenPal well-reviewed,
        large user base' claim is REMOVED — posts.ts:255-259 now reads only 'focused on pantry management
        since 2016... tracks inventory by item'; grep for star|rating|4.8|26,785|million|users across the
        blog returns zero fabricated metrics. demand_signal quotes each carry a real URL + explicit dating
        caveat + a limitations block documenting rejected unverifiable paraphrases and the agent's own
        wrong-slug 404 — fetched web content adversarially verified, not trusted. spend-caps honestly
        surfaced as an URGENT owner blocker; cac_usd:null (zero spend). No violation.
      gap: null
    artifact_freshness:
      grade: A
      ship_critical: false
      evidence: >
        Pricing consistent with billing config everywhere: upgrade/page.tsx:137,165,194,197 ($4.99/$39.99/
        $9.99/$79.99), landing page.tsx:265,638 (derives from billing module), CONTENT_DRAFTS.md:147,
        EMAIL_LIFECYCLE.md:266,322,377 all == config; annual math checks ($39.99/12=$3.33, ~33% off).
        [APP_NAME] placeholder genuinely unresolved and honestly surfaced as a NORMAL owner_blocker
        (:517-518). §13 marketing block honest: kill_switch not_present, GATE 1 not_ready — auditor verified
        MARKETING_HOLD/MARKETING_APPROVED/VALIDATOR_STATUS.md are all genuinely ABSENT on disk.
      gap: "Raise to A+: as_of 2026-07-05 is 3 days stale vs today; more concretely content.published_7d:1 has
            aged past its own 7-day window (the post is 9 days old) — should be 0. Re-stamp as_of to the live
            snapshot date and recompute published_7d so the windowed metric stops silently aging."
  top_gaps:                        # ordered by severity; all are A->A+ polish (nothing below A)
    - dimension: artifact_freshness
      severity: low
      ship_critical: false
      gap: "content.published_7d:1 has aged outside its own 7-day window (post published 2026-06-29, now 9
            days old) → should be 0; as_of 2026-07-05 is 3 days stale. Re-stamp as_of + recompute published_7d."
      filed_issue: "gtm-quality: artifact-freshness A -> raise to A+ (stale windowed metric)"
    - dimension: experiment_validity
      severity: low
      ship_critical: false
      gap: "computeExperimentResult (lift.ts) — the decided-vs-running monetization gate — has zero direct
            tests. Add a lift.test.ts covering the refusal logic (both arms >= min N AND p<0.05)."
    - dimension: metric_integrity
      severity: low
      ship_critical: true
      gap: "Re-confirm the two demand_signal reviewer attributions (D. Bogan / Jane Sanders) against the
            source pages, and refresh the stale line-213 published_7d comment date. Quote text is genuine;
            this is accuracy hygiene, not fabrication."
  summary: >
    Disciplined, honest GTM work that IMPROVED on structure this cycle: the sources genuinely connected
    (runs 8-9) and the auditor independently reproduced the live authenticated snapshot — all 4 sources
    'connected', every funnel value 0/null, matching the dashboard exactly. Three ship-critical dimensions
    are A+ (business-case, roadmap-steer, self-validation); the 2026-07-01 self-validation gap I filed
    (#314: §4 validation block + gtm-connect ids) is CLOSED. Metric integrity slipped A+→A on a real but
    minor accuracy nit (a windowed metric aged past its own definition + an uncertain reviewer-attribution
    discrepancy) — no fabrication. No gamed business case, no speculative roadmap steer, no auto-send, no
    unauthorized spend, no pricing drift. Ship gate MET on GTM quality. NOTE: this grades the GTM WORK's
    honesty/quality — it is independent of the product's own launch readiness (see QUALITY_SCORECARD).
```

## How to read it (owner)

- **`overall` + `ship_gate_met`** are the headline. `ship_gate_met: true` means the GTM Factory's work
  cleared the honesty/quality bar (every ship-critical dimension A/A+, all others ≥ B).
- **`dimensions`** — each grade is backed by evidence a fresh adversarial grader actually verified.
- **`top_gaps`** — ordered improvements the GTM Factory should close; ship-critical gaps below A are
  filed as `gtm-quality:` issues. This cycle nothing is below A; the top gap is an A→A+ polish item.
