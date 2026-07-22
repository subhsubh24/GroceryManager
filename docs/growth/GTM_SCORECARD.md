# GTM SCORECARD — GroceryManager

The independent **GTM Auditor's** evidence-backed grade of the GTM Factory's revenue/go-to-market work,
against [`docs/growth/GTM_RUBRIC.md`](./GTM_RUBRIC.md). The GTM Auditor (checker) writes this file; the
GTM Factory (maker) never grades its own work (maker ≠ checker). This is to GTM exactly what
`docs/quality/QUALITY_SCORECARD.md` is to the product. The dashboard reads the fenced `GTM_SCORECARD`
block below. Every grade cites concrete evidence a fresh, adversarial grader subagent actually checked.

```yaml
GTM_SCORECARD:
  project: GroceryManager
  as_of: 2026-07-22
  overall: A
  ship_gate_met: true            # true ONLY when every ship_critical dim is A/A+ AND all others >= B
  phase_context: pre_launch      # sources CONNECTED (runs 8-14); store not live (eas-build-submit-go-live
                                 #   still OPEN — re-verified PENDING_OPS.md:112-115). GTM Factory's own
                                 #   dashboard is as_of 2026-07-19 (run 14); funnel honestly ~0/null —
                                 #   auditor re-verified against the live authenticated snapshot this run.
  method: "2 fresh, independent, adversarial grader subagents (Opus-class) + heavy first-hand auditor
           verification. Neither grader did the GTM work. The auditor reproduced the live claims directly:
           an authenticated GET https://grocery-manager-web.vercel.app/api/growth/snapshot (Bearer
           $CRON_SECRET, present in the auditor's env) returned HTTP 200 with all 4 sources 'connected'
           and the funnel all 0/null except visitors_7d:2 (the dashboard's run-14 value is 3 — a rolling
           7-day window captured 3 days earlier; honest fluctuation, not fabrication). Grader 1 (metric
           integrity) WebFetched BOTH demand_signal source pages (complaintsboard.com + grand-screen.com)
           and verified every quote text verbatim + tested reviewer-name stability. Grader 2 recomputed
           the business case, checked the self-validation block against the live snapshot, and audited the
           compliance surface (finding a real, dormant, credential-gated social publisher). The auditor
           confirmed ROADMAP/VISION authorship via git log and checked the open gtm-quality issues."
  dimensions:
    metric_integrity:
      grade: A
      ship_critical: true
      evidence: >
        NO fabricated metric anywhere → nowhere near F. Auditor INDEPENDENTLY reproduced the live
        authenticated snapshot (GET /api/growth/snapshot, Bearer $CRON_SECRET → HTTP 200): funnel
        visitors_7d:2 (dashboard reports 3 at run 14 — a 3-day-old rolling-window capture; the doc even
        flags N=3 as "statistically vacuous," honest), waitlist_signups_total:0, active_subscribers:0,
        mrr_usd:0, trial_to_paid_rate:null; 3 experiments landing_hero/h14_annual_nudge/h15_winback all
        running/null — matching packages/core/src/growth/experiments/registry.ts (real ids, not invented).
        Adversarial grader WebFetched BOTH demand_signal source pages this cycle and confirmed all SIX
        quote TEXTS are verbatim-genuine on the real pages (complaintsboard.com/paprika-recipe-manager-3
        + grand-screen.com KitchenPal/My-Pantry-Tracker/Grocery-AI) — quote integrity fully intact. My
        prior filed gap (#570) is PARTLY closed: run 12 correctly downgraded the complaintsboard reviewer
        names to "reviewer name UNCERTAIN" (GROWTH_STATUS.md:752,764,768-779) with thorough, honest
        reasoning (3 fetches, 2 names, documented as a LESSON) — an exemplary response to the demonstrated
        non-determinism.
      gap: "Off A+ (issue #570 stays OPEN — the gap MOVED, not closed): the factory softened only the
            COMPLAINTSBOARD names but KEPT the GRAND-SCREEN.COM KitchenPal names asserted as settled
            corrections (GROWTH_STATUS.md:793-798: 'Slow when creating a new item...' attributed to 'Lars
            Uriel, not Jane Sanders'). A fresh adversarial WebFetch of grand-screen.com this cycle returned
            that quote attributed back to 'JANE SANDERS' — the EXACT name run 10 'corrected away' — proving
            grand-screen name-extraction is the SAME source-class non-determinism that triggered #570. FIX:
            extend the 'reviewer name UNCERTAIN' softening to the grand-screen.com quotes (DAH/Maria Veen/
            Lars Uriel/Steven Wilshire/Bill Garner), keeping the genuine quote text + URL + dating caveat.
            Quote text genuine → precision nit, not fabrication; the demand signal rests on recurring quote
            TEXT across structurally different apps, not on any reviewer identity."
    business_case_honesty:
      grade: A+
      ship_critical: true
      evidence: >
        Adversarial grader + auditor both recomputed from stated inputs. Prices reconcile EXACTLY: billing
        config (packages/core/src/billing/index.ts:43,59,69,70 → 499/3999 monthly/annual, family 999/7999)
        == BUSINESS_CASE.md:44-46 ($4.99/$39.99, family $9.99/$79.99). All 3 scenarios recompute to the
        doc's numbers: conservative 500×0.35×0.025÷0.065×$3.82×12 = $3,085≈$3,100 (:197); base
        1500×0.45×0.04÷0.037×$3.82×12 = $33,449≈$33,450 (:212); optimistic 6000×0.55×0.06÷0.030×$4.32×12 =
        $342,144≈$342,000 (:231). Blended churn recomputes to 3.71% (:168), ARPU to $3.82 (:56) — exact.
        Summary YAML (:7-15) matches the body; floor_met_year1:false consistent at :13,:218 ("below the
        $100K floor") and reiterated §5/§8. Nothing gamed UP — base is ~1/3 of the floor, and the doc
        self-documents rolling a PRIOR gamed ~$106K down to the honest ~$33K on the cited 2-5% freemium
        benchmark. Doc unchanged since 2026-06-27; still reconciles.
      gap: null
    roadmap_steer_justification:
      grade: A+
      ship_critical: true
      evidence: >
        Zero GTM-authored ROADMAP/VISION steers. `git log --format='%ae' -- ROADMAP.md VISION.md` since
        2026-07-15 returns ONLY airjordan33@gmail.com (the OWNER) — the single commit is #586 (a
        FACTORY_STANDARD §44 bug-hunter edit), none by the Growth Agent; a full-history check
        (`git log ... | grep -v airjordan33`) returns EMPTY — no Growth-Agent roadmap/vision commit has
        EVER landed. With the funnel all 0/null (live-verified), zero steers is the correct answer and it
        is exactly what happened. No adoption %/conversion figure was banked from demand_signal or the
        content-validation work into any roadmap/vision/business figure (both self-police that they change
        no modelled number).
      gap: null
    self_validation_honesty:
      grade: A+
      ship_critical: true
      evidence: >
        Adversarial grader confirmed: GROWTH_STATUS sources (:84-102, all 'connected') MATCH the auditor's
        live authenticated snapshot EXACTLY — no claimed-but-unconnected channel (the F trigger) exists.
        Every deviation UNDER-claims: dashboard channels_connected:[email] (:58) is narrower than the
        snapshot's [analytics,billing,email] (analytics/billing tracked truthfully as measurement/
        monetization infra, not marketing channels), and dashboard phase:pre_launch (:43) is more
        conservative than the snapshot's code-level 'launching' — reporting a more conservative state than
        the API is the A+ signature. Email 'connected' is fail-closed on deliverability (open_rate/
        click_rate null :216-217; "key-present != deliverability-proven" :102). All 4 gtm-connect-{waitlist,
        analytics,billing,email} owner actions resolved (PENDING_OPS :46-82, status:done). Filed gap #314
        stays CLOSED.
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
            decided-vs-running monetization gate — STILL has ZERO direct tests (only stats.test.ts exists in
            packages/core/src/growth/experiments/; no lift.test.ts). Unchanged since 2026-07-08. Product-
            Factory code territory (already a GROWTH_STATUS next_action); add a lift.test.ts asserting
            'running' at sub-N/non-significant and 'decided' only on sufficient+significant."
    pmf_read_accuracy:
      grade: A+
      ship_critical: false
      evidence: >
        pmf block (GROWTH_STATUS.md:157-169) fully null with signal:none — the correct pre-data read.
        next_actions point EXCLUSIVELY at product/infra/connect fixes (§29 sweep, eas-build-submit-go-live,
        the owner-executes content-validation kit), never 'scale acquisition'; acquisition.cac/ltv/ratio/
        top_channel all null (:152-156, zero spend). No flattery — no claimed PMF signal unbacked by cohort
        data. Correct pre-PMF posture: recommend product/retention, not acquisition scaling.
      gap: null
    compliance:
      grade: A
      ship_critical: false
      evidence: >
        Adversarial grader found ZERO compliance VIOLATIONS. Outreach is genuinely draft-only (OUTREACH.md:5
        "the agent never sends... no auto-send ever"; drafted/sent/replies all 0). The content-validation
        surface is strictly PREPARE-only (CONTENT_VALIDATION_KIT.md:4 "the OWNER films the reaction cut and
        posts it. No autonomous posting, no manufactured engagement, no fabricated comment/view counts";
        content_validation.status:prepared, posted_7d:0, comment_signal:none "never inferred from view
        count alone"). Blog (apps/web/app/blog/posts.ts) carries no fabricated competitor metric (no star
        ratings / user counts / "millions"; the removed KitchenPal "large user base" claim stays removed —
        run-2 learning GROWTH_STATUS.md:313-318). demand_signal quotes carry real URLs + dating/attribution
        caveats. cac_usd null (zero spend). No fake accounts/engagement/reviews; no auto-send.
      gap: "Off A+ — an HONESTY-PRECISION correction of this auditor's OWN prior framing (NOT a factory
            regression): the 2026-07-15 scorecard credited compliance A+ partly on 'the agent has NO
            social-posting tool (enforced-by-absence-of-capability)'. That premise is FALSE — a real owned-
            channel social publisher EXISTS and is cron-wired: packages/core/src/content/scheduler.ts posts
            to X/Buffer/Typefully (fetch to api.twitter.com/2/tweets), invoked by apps/web/app/api/cron/
            publish/route.ts. It is NOT a violation — it is credential-gated (degrades to skipped without
            keys), hard-blocks community/forum channels at code level, is currently fully dormant
            (published_7d:0, no social channel connected), and is openly DISCLOSED as growth-engine anchor
            piece 3 (GROWTH_STATUS.md:27-29). So the factory does not over-claim; the accurate constraint
            is 'a constrained, dormant, owner-credential-gated publisher that has posted nothing', not
            'absence of capability'. Behavior is clean; the A+-earning 'airtight-by-absence' framing is the
            named finding that holds it at A. FIX (auditor + doc precision): stop asserting enforcement-by-
            absence anywhere; describe the publisher as dormant + credential-gated + community-channel-blocked."
    artifact_freshness:
      grade: A
      ship_critical: false
      evidence: >
        Pricing consistent with billing config everywhere (BUSINESS_CASE + upgrade page all == config).
        content.published_7d correct at 0 (:219). The 2026-07-15 filed freshness concern is RESOLVED: the
        §13 marketing block now correctly re-reads the QUALITY_SCORECARD fresh (:260-264 — ship_gate_met:
        true, QUALITY as_of 2026-07-13, design_taste held at A) — no longer telling the stale
        "design_taste B / mobile icon-system gap" GATE-1 story the run-11 dashboard did; auditor verified
        QUALITY_SCORECARD.md:24-26 is genuinely still as_of 2026-07-13 / overall A / gate met (no newer
        grade exists, so re-reading it is correct, not stale). §13 kill-switch fields auditor-verified
        against disk (MARKETING_HOLD absent).
      gap: "Raise to A+: (1) as_of 2026-07-19 (run 14) is 3 days behind today. (2) GROWTH_STATUS
            funnel.visitors_7d:3 reads one higher than the live snapshot's 2 — honest 7-day-window aging
            (a visit rolled out), and the doc flags N as statistically vacuous, so no material over-read,
            but the dashboard number trails the live source by a cadence gap. Both self-heal on the next
            GTM run's fresh snapshot pull; recorded, not separately filed (a cadence-run dashboard is never
            exactly current by design)."
  top_gaps:                        # ordered by severity; none blocks the gate (all ship_critical A/A+, others >= A)
    - dimension: metric_integrity
      severity: low
      ship_critical: true
      gap: "The grand-screen.com KitchenPal reviewer names are still asserted as settled corrections
            ('Lars Uriel, not Jane Sanders') while a fresh auditor WebFetch this cycle returns 'Jane
            Sanders' again — the SAME source-class non-determinism the factory acknowledged and softened
            for complaintsboard. The complaintsboard half of #570 is genuinely fixed (softened to
            UNCERTAIN); extend that softening to the grand-screen.com quotes. Quote TEXT is verbatim-genuine
            (not fabrication); the demand signal rests on recurring text, not reviewer identity."
      filed_issue: "gtm-quality: metric-integrity A -> raise to A+ (over-asserted demand_signal attribution) — #570 kept OPEN, updated with the grand-screen finding"
    - dimension: compliance
      severity: low
      ship_critical: false
      gap: "Auditor self-correction (not a factory regression): the prior A+ rationale ('no social-posting
            capability, enforced-by-absence') is false — a real, dormant, credential-gated owned-channel
            publisher (packages/core/src/content/scheduler.ts + apps/web/app/api/cron/publish/route.ts)
            exists, posts nothing, and is disclosed as engine anchor 3. No violation; compliance BEHAVIOR is
            clean. Describe the constraint accurately (dormant + credential-gated + community-channel-blocked)
            rather than as absence-of-capability. Recorded, not separately filed — it is the auditor's own
            framing to fix, and the factory posture is already compliant."
    - dimension: experiment_validity
      severity: low
      ship_critical: false
      gap: "computeExperimentResult (lift.ts) — the decided-vs-running monetization gate — still has zero
            direct tests (only stats.test.ts). Add a lift.test.ts. Product-Factory code territory; already a
            GROWTH_STATUS next_action — recorded, not separately filed."
    - dimension: artifact_freshness
      severity: low
      ship_critical: false
      gap: "as_of 2026-07-19 is 3 days stale; GROWTH_STATUS visitors_7d:3 trails the live snapshot's 2
            (honest 7-day-window aging). Self-heals on the next run's snapshot pull — recorded, not filed."
  summary: >
    Disciplined, honest GTM work; ship gate MET on GTM quality (all 4 ship-critical dimensions A/A+, all
    non-critical >= A). The auditor independently reproduced the live authenticated snapshot: all 4 sources
    'connected', funnel all 0/null except 2 real organic visitors the dashboard honestly over-reports by 1
    (rolling-window aging) — no fabrication, no flattery. Three ship-critical dimensions are A+: the business
    case reconciles EXACTLY (all 3 scenarios recomputed to the cent-rounding, prices == billing config,
    floor honestly NOT met), zero GTM-authored roadmap/vision steers ever (git-verified), and self-validation
    matches the live snapshot while consistently UNDER-claiming. Metric integrity holds at A: the factory gave
    an EXEMPLARY response to my prior gap (#570) — it re-fetched complaintsboard three times, documented the
    two-name non-determinism as a lesson, and softened those reviewer names to UNCERTAIN — but a fresh
    adversarial WebFetch this cycle shows the grand-screen.com names it KEPT asserted ('Lars Uriel') flip to
    'Jane Sanders', the identical instability; the gap MOVED rather than closed, so #570 stays open (all six
    quote TEXTS are verbatim-genuine, so a precision nit, not fabrication). Compliance moves A+ -> A this
    cycle on an HONESTY-PRECISION correction of THIS auditor's OWN prior framing: an adversarial read found a
    real but dormant, credential-gated, community-channel-blocked social publisher (scheduler.ts + cron/
    publish) that the prior scorecard wrongly characterized as 'absent capability' — no violation, behavior
    is clean, but the A+-earning 'airtight-by-absence' claim doesn't hold. No gamed business case, no
    speculative roadmap steer, no auto-send, no unauthorized spend, no pricing drift, no fabricated metric.
    NOTE: this grades the GTM WORK's honesty/quality — independent of the product's own launch readiness
    (QUALITY_SCORECARD, as_of 2026-07-13, holds its own ship gate).
```

## How to read it (owner)

- **`overall` + `ship_gate_met`** are the headline. `ship_gate_met: true` means the GTM Factory's work
  cleared the honesty/quality bar (every ship-critical dimension A/A+, all others ≥ B).
- **`dimensions`** — each grade is backed by evidence a fresh adversarial grader and/or the auditor
  actually verified (live snapshot, recomputed business case, git authorship, WebFetched sources).
- **`top_gaps`** — ordered improvements the GTM Factory should close; the top gap is filed as a
  `gtm-quality:` issue (#570, kept open + updated). This cycle nothing is below A; all four gaps are
  A→A+ polish, and the compliance one is the auditor correcting its own prior over-generous framing.
