# GTM SCORECARD — GroceryManager

The independent **GTM Auditor's** evidence-backed grade of the GTM Factory's revenue/go-to-market work,
against [`docs/growth/GTM_RUBRIC.md`](./GTM_RUBRIC.md). The GTM Auditor (checker) writes this file; the
GTM Factory (maker) never grades its own work (maker ≠ checker). This is to GTM exactly what
`docs/quality/QUALITY_SCORECARD.md` is to the product. The dashboard reads the fenced `GTM_SCORECARD`
block below. Every grade cites concrete evidence a fresh, adversarial grader subagent actually checked.

```yaml
GTM_SCORECARD:
  project: GroceryManager
  as_of: 2026-07-01
  overall: A
  ship_gate_met: true            # true ONLY when every ship_critical dim is A/A+ AND all others >= B
  phase_context: pre_launch      # PREPARE mode; no channels connected; funnel honestly 0/null
  method: "4 fresh, independent, adversarial grader subagents (Opus), none of which did the GTM work,
           each told to REFUTE the GTM Factory's claims and cite file:line/commit evidence."
  dimensions:
    metric_integrity:
      grade: A+
      ship_critical: true
      evidence: >
        Entire GROWTH_STATUS block (GROWTH_STATUS.md:40-140) is 0/null/empty across funnel, pmf,
        acquisition, experiments, channels, email, outreach — correct honest pre-launch reporting with
        awaiting_connect:true. Only 3 non-zero values, all legitimate: engine_pct:100/engine_built:true
        are CODE-DERIVED (scripts/preflight.sh:194-231 recomputes from 5 anchor files on disk and fails
        on drift — not fabricatable; all 5 files verified present) and scheduled_next_7d:1 maps to a real
        staged blog post (apps/web/app/blog/posts.ts:219). Adversarial fabrication hunt confirmed the 19
        real app-signups (PENDING_OPS.md:18) did NOT leak into funnel as a fake waitlist count — users and
        waitlist_submissions are separate tables (packages/db/src/queries.ts:1669-1696); the snapshot route
        returns null (not a number) on any Plausible failure. No fabricated/unsourced metric found.
      gap: null
    business_case_honesty:
      grade: A+
      ship_critical: true
      evidence: >
        Prices reconcile EXACTLY: billing config (packages/core/src/billing/index.ts:40,56,64-66 →
        499/3999 monthly/annual, family 999/7999) == BUSINESS_CASE.md:44-46 ($4.99/$39.99, family
        $9.99/$79.99). Summary YAML (BUSINESS_CASE.md:7-14) matches body; grader independently recomputed
        conservative ($3,085≈$3,100), base ($33,451≈$33,450), optimistic ($342,144≈$342,000), blended
        churn (3.71%), and ARPU ($3.82) — all match, 15% platform fee correctly applied. Genuinely
        corrected DOWN: prior gamed 12.6% signup→paid (2.5-6x the cited 2-5% freemium benchmark) was
        re-grounded to base 4%, moving base FROM ~$106K (above floor) TO ~$33K (below floor) — the
        opposite of gaming. floor_met_year1:false is honest and consistent throughout (§4/§5/§8).
      gap: "Minor (does not lower grade): base 4% free→paid sits at upper-mid of the 2-5% band vs the
            cited 2.18% median; the doc defends 4% via the Gmail-import hook and discloses the tension."
    roadmap_steer_justification:
      grade: A
      ship_critical: true
      evidence: >
        Zero GTM-authored ROADMAP/VISION steers exist — the honest correct state pre-launch with no
        connected analytics. git log -- ROADMAP.md VISION.md returns only product/quality-factory commits
        (270052c, a784d61); a784d61 actually RETRACTS an unbacked 'performance budget' claim
        (ROADMAP.md:319-323) rather than inflating one. BUSINESS_CASE.md §5 (253-266) confirms the
        run-20/22 product builds (PR #197/#198/#217) left median ARR 'deliberately UNMOVED... no adoption
        % banked to clear the floor'. No speculative or low-confidence steer reached the roadmap.
      gap: "Not A+ only because the §3 causal-mechanism discipline has no worked example yet (no real
            signal has arrived to exercise it) — a limitation of pre-launch state, not a defect."
    self_validation_honesty:
      grade: A
      ship_critical: true
      evidence: >
        All four sources (waitlist, analytics, billing, email) honestly marked awaiting_connect
        (GROWTH_STATUS.md:53-57), matching real env-gated runtime checks in the snapshot route
        (apps/web/app/api/growth/snapshot/route.ts:69,79-83,92-95). owner_blockers (:124-136) surface every
        unconnected source and cross-reference PENDING_OPS ids (track-h-activation:open, site-gate-prelaunch:open).
        No claimed-connected-but-unconnected source anywhere — nowhere near F.
      gap: "Raise to A+: GTM_STANDARD §4 prescribes an explicit `validation:` block in GROWTH_STATUS and
            URGENT `gtm-connect-<source>` owner-action ids; neither exists (grep for 'validation'/'gtm-connect'
            in docs/growth returns nothing) — the connect actions use ad-hoc ids instead. A real, named,
            STRUCTURAL gap only; the underlying honesty is fully intact, so it does not breach integrity."
    experiment_validity:
      grade: A
      ship_critical: false
      evidence: >
        experiments:[] (GROWTH_STATUS.md:89) is honestly empty — no fabricated/p-hacked wins. Methodology is
        real code: packages/core/src/growth/experiments/stats.ts (twoProportionZTest, wilsonInterval,
        minSampleSizePerArm); lift.ts:39-105 refuses a winner unless BOTH arms exceed minSamplePerArm AND
        p<0.05, else returns 'running' (codified insufficient-data honesty). Commit 338c5b3 is a genuine
        adversarial catch: a zFromAlpha sign bug that collapsed required N ~10x was fixed WITH a monotonicity
        regression test. ANALYSIS_PLAYBOOK §3 mandates significance + min sample size before any winner.
      gap: "Raise to A+: the significance apparatus is validated only by unit tests; add a bucket-assignment
            balance + exposure-dedup coverage test on the H10 path so the first live experiment can't be
            corrupted by an assignment bug the way it nearly was by the power bug."
    pmf_read_accuracy:
      grade: A
      ship_critical: false
      evidence: >
        pmf block (GROWTH_STATUS.md:75-87) all null with signal:none — the correct 'no analytics connected'
        read, not flattery. Recommendation is a CONNECT/activation fix, never premature acquisition scaling:
        next_actions (:118-123) + owner_blockers (:124-136) point at connecting analytics/email/site-gate and
        nurturing captured-but-unconfirmed signups. ANALYSIS_PLAYBOOK.md:65-67 FORBIDS pre-PMF acquisition
        scaling and gates it behind an emerging/flattening weekly curve; no violation found.
      gap: "Raise to A+: once ADMIN_EMAIL connects, quantify the already-visible captured-vs-confirmed signup
            delta as a first real activation-funnel observation."
    compliance:
      grade: A
      ship_critical: false
      evidence: >
        Draft-only discipline holds: outreach.drafted_7d/owner_sent_7d/replies_7d all 0 (GROWTH_STATUS.md:102-104),
        consistent with site_gate_up:false. OUTREACH.md:5 hard-codes 'DRAFT ONLY — the agent never sends'; RUN
        LOG (GROWTH_MEMORY.md:34-56) is explicitly PREPARE mode, no external actions. 4th blog post
        (apps/web/app/blog/posts.ts:219-278) carries NO invented competitor metrics/ratings — qualitative,
        defensible descriptions only; LESSON-0 explicitly bans inventing counts/ratings. No fake
        reviews/accounts/spend/auto-send.
      gap: "Raise to A+: one unsourced qualitative third-party claim ('KitchenPal well-reviewed, large user
            base', posts.ts:257) — low FTC risk; cite or soften to fully close."
    artifact_freshness:
      grade: A
      ship_critical: false
      evidence: >
        Pricing consistent everywhere: growth/brand copy (CONTENT_DRAFTS.md:146, EMAIL_LIFECYCLE.md:266,321-322),
        landing (page.tsx:638), upgrade page (upgrade/page.tsx:137,165) all == billing config ($4.99/$39.99).
        [APP_NAME] placeholder honestly surfaced as a NORMAL owner_blocker (:135-136); the 3 named candidates
        (Pantri/Mise/Larder) match docs/brand/NAMING_CANDIDATES.md:10,38,68. as_of 2026-06-29 vs today
        2026-07-01 is 2 days stale — acceptable for a low-frequency pre-launch routine and self-documented as
        a signal (:36-37), not drift.
      gap: "Raise to A+: [APP_NAME] placeholder blocks finalizing store/email copy — an owner name pick
            (Pantri/Mise/Larder), not an agent error."
  top_gaps:                        # ordered by severity; all are A->A+ polish (nothing below A)
    - dimension: self_validation_honesty
      severity: low
      ship_critical: true
      gap: "Add the GTM_STANDARD §4 explicit `validation:` block + `gtm-connect-<source>` owner-action ids;
            honesty is intact today via owner_blockers, but the prescribed structure is missing."
      filed_issue: "gtm-quality: self-validation A -> raise to A+"
    - dimension: experiment_validity
      severity: low
      ship_critical: false
      gap: "Add bucket-assignment balance + exposure-dedup coverage test on the H10 experiment path."
    - dimension: compliance
      severity: low
      ship_critical: false
      gap: "Cite or soften the unsourced 'KitchenPal large user base' qualitative claim in the 4th blog post."
  summary: >
    Disciplined, honest pre-launch PREPARE-mode GTM work. Two ship-critical honesty dimensions (metric
    integrity, business-case honesty) are A+; the other two (roadmap-steer, self-validation) are A. No
    fabricated metric, no gamed business case, no speculative roadmap steer, no auto-send, no unauthorized
    spend, no pricing drift. All remaining gaps are A->A+ polish (mostly honestly-flagged owner blockers).
    Ship gate MET on GTM quality. NOTE: this grades the GTM WORK's honesty/quality — it is independent of
    the product's own launch readiness (see QUALITY_SCORECARD / issue #260).
```

## How to read it (owner)

- **`overall` + `ship_gate_met`** are the headline. `ship_gate_met: true` means the GTM Factory's work
  cleared the honesty/quality bar (every ship-critical dimension A/A+, all others ≥ B).
- **`dimensions`** — each grade is backed by evidence a fresh adversarial grader actually verified.
- **`top_gaps`** — ordered improvements the GTM Factory should close; ship-critical gaps below A are
  filed as `gtm-quality:` issues. This cycle nothing is below A; the top gap is an A→A+ polish item.
