# GroceryManager — Quality Scorecard

> **Independent grade** assigned by the separate Quality Auditor routine (maker ≠ checker). The
> factory loop CONSUMES this as a DATA signal and never authors/overwrites it. Every grade below is
> backed by a mechanical signal the grader actually ran this cycle, plus file/line evidence. Grades
> may not exceed what the signals support. See `QUALITY_RUBRIC.md` for the scale and dimensions.

**As of 2026-07-01.** Overall: **A**. Ship gate: **MET** — every ship-critical dimension
(`functional_reality`, `correctness_reliability`, `security`, `design_taste`, `launch_readiness`) is
at **A**, and every other dimension is **≥ B**. Both ship-critical gaps that blocked the gate at the
2026-06-29 baseline (mobile IAP stub; the vision direct-`pantry_stock` write + untested vision path)
are now fixed and regression-guarded. Two non-ship-critical dimensions remain at **B** with named,
non-blocking gaps: `tests_evals` (no vision-quality LLM eval) and `performance` (no CI perf-budget
gate + a 276 KB uncompressed edge middleware).

```yaml
QUALITY_SCORECARD:
  as_of: 2026-07-01
  overall: A
  ship_gate_met: true
  graded_by: independent-quality-auditor   # maker != checker; one fresh adversarial subagent per dimension
  mechanical_signals:
    typecheck: pass                          # pnpm -r run typecheck → exit 0 (all packages Done)
    core_tests: pass                         # pnpm --filter @gm/core test → exit 0; 92 files pass / 9 skipped; 817 tests pass / 24 skipped; coverage lines 86.42 / branches 87.24 / functions 89.82 (thresholds 70/84/76/70 met)
    prod_build: pass                         # NODE_ENV=production next build → exit 0; no missing-export warnings; 102 kB shared first-load; middleware reported 88.5 kB (gzip of an unchanged 276 KB edge bundle)
  dimensions:
    - name: functional_reality
      grade: A
      ship_critical: true
      evidence: >-
        Real journeys wired to withTenant DB writes + the append-only ledger. signup/page.tsx:57-78
        (createUserWithPassword→signIn→/onboarding, no dead-end); page.tsx:88-130 (home = one withTenant
        tx, degrades to a quiet zero-model, never fake data); cook-actions.ts:39-53 + recipe/log-cook.ts:141-188
        (cook writes MealLog + consume_recipe ledger deltas); list/page.tsx:21-25 + e2e/journeys.spec.ts:19-64
        (outcome-asserting: signup→working dashboard, nav resolution, auth boundary). Baseline vision
        direct-write is fixed AND tripwire-guarded (persist.unit.test.ts:98). Repo grep: the sole
        pantry_stock writer is reprojectStock (pantry/persist.ts:129).
    - name: correctness_reliability
      grade: A
      ship_critical: true
      evidence: >-
        Both baseline ship-critical gaps FIXED. (1) vision/persist.ts references pantryStock only in a
        .select() read (68-77); every mutation routes through appendLedgerAndReproject (102-113,156-166);
        5 tests assert db.update NOT called (persist.unit.test.ts:97-100). (2) vision detect/persist/resolve
        + generate-llm now genuinely covered (reconcile.test.ts locks absence≠depletion 59-76; generate-llm
        clamps 1..6 + pantry cap 40). Independently verified: EWMA guards <2 purchases + skips non-positive
        intervals (depletion.ts:76-92); spoilage grace ceiling (124-137); generateWithVerify try/catches +
        escalates + circuit-breaks (client.ts:266-297). No correctness bug found.
    - name: security
      grade: A
      ship_critical: true
      evidence: >-
        40 routes audited, ZERO unauth'd data surfaces. Every per-user surface enforces verifyMobileToken
        (HMAC), jose jwtVerify (aud gm-mobile), currentUserId() session, isCronAuthorized, or timing-safe
        webhook secret; all per-user DB access in withTenant (client.ts:71-84, UUID-guarded fail-closed).
        RLS deny-by-default (0002_rls.sql:30-53, non-owner runtime role). Stripe constructEvent (webhooks/
        stripe:50) + RevenueCat timingSafeEqual (webhooks/revenuecat:51-69) both fail closed. Entitlement
        server-side only (webhook-written signal; checkout userId server-resolved). No secrets in source;
        OAuth tokens encrypted. Only documented CSP/CORS tradeoffs remain.
    - name: design_taste
      grade: A
      ship_critical: true
      evidence: >-
        Real token system, not default Tailwind: globals.css:5-50 variable-backed RGB ramps + dark-mode
        inversion + contrast-holding --brand-solid; tailwind.config.ts:139-145 bespoke type scale; one
        typeface (Hanken Grotesk). Retired palette neutralized — every legacy *-gradient resolves to a
        single brand-solid fill (config:162-178); zero rainbow/purple hex in web tsx or mobile (#309/#308
        verified). Honest empty states (pantry/page.tsx:354-363; EMPTY_HOME_DATA). a11y: cook-mode timer
        controls aria-labeled + min-h-[44px] (cook-mode.tsx:141-184); 16px mobile inputs (globals.css:445-451).
        Zero emoji in web UI (icons from the registry).
    - name: launch_readiness
      grade: A
      ship_critical: true
      evidence: >-
        Baseline sole blocker FIXED — mobile IAP is a real purchase flow: upgrade.tsx:82-103 (onBuy→purchase
        (pkg)→res.status active) → purchases.ts:103-113 real Purchases.purchasePackage() + hasPremiumEntitlement,
        restore() wired (App Store req). Degrades without key via isPurchasesConfigured() (purchases.ts:37);
        inert "coming soon" only in the unconfigured branch — mirrors web Stripe. Server-side entitlement:
        webhooks/revenuecat fails closed (timing-safe 64-69), maps GRANT/REVOKE into the same appendPreferenceSignal
        ledger as Stripe. Store assets real (icon 1024², feature-graphic 1024×500), privacy/terms substantive
        (154/155 lines), account deletion via ON DELETE CASCADE (mobile/account:15-47), eas.json prod profiles.
    - name: tests_evals
      grade: B
      ship_critical: false
      evidence: >-
        Both baseline structural gaps CLOSED: logCook 7.97%→99.27% lines (log-cook.unit.test.ts asserts exact
        appendLedgerAndReproject args, dedupe, no-dangling-decrement throw); vision 98.84% lines (persist/
        resolve/reconcile 100%; reconcile.test.ts's 16 cases lock absence≠depletion + confidence floors). 5
        real LLM evals with golden fixtures + pass-rate (≥0.8) + LLM-judge (≥0.7) thresholds. Coverage floor
        enforced + met. All 9 skips are honest env-gated (skipIf !DB / !RUN_EVALS), no hidden test.skip. GAP
        (holds it at B): no vision-quality eval — detect.ts is only unit-tested with a stubbed client; there
        is no LLM-judge on real fixture images scoring scan item-count accuracy, on a flagship "pantry fills
        itself" LLM stage.
    - name: artifact_integrity
      grade: A
      ship_critical: false
      evidence: >-
        check-self-validation.mjs → exit 0 ("every active capability self-validated"); --readiness → exit 0
        (unmet []). All 5 active capabilities' declared spec/test files exist and genuinely exercise the
        capability (billing entitlement gating; rate-limit hard-refuse in prod; email round-trip with tamper
        rejection; outcome-asserting journeys). No capability parked planned/retired to dodge the tripwire; no
        undeclared env-gated test.skip (the one e2e skip, email-roundtrip on EMAIL_CAPTURE_DIR, is declared +
        wired in ci.yml). Baseline F4 "performance budgets" tick RECONCILED (retracted to "Playwright E2E
        smoke", commit a784d61). Pricing consistent across billing/index.ts == BUSINESS_CASE.md == store copy.
    - name: business_case
      grade: A
      ship_critical: false
      evidence: >-
        Honest: floor_met_year1 false (BUSINESS_CASE.md:13; median base ≈$33K/yr vs $100K floor). Prior gamed
        12.6% conversion corrected to a cited 4% freemium free→paid (within the 2-5% Amplitude/OpenView band,
        150). Every scenario recomputed independently and reconciles (ARPU $3.82, base ARR $33,451, floor needs
        2,182 users). Prices sourced from billing/index.ts (499/3999/999/7999). Growth levers BUILT not listed:
        experiments z-test (growth/experiments/stats.ts:46), margin-bounded referral ladder (referral/rewards.ts:29-89),
        lifecycle emails (with anti-overclaim guard), cohort retention, UTM (migrations 0012-0020). LLM cost
        capped (llm-quota.ts:26). #316 MRR amortization fix correct + conservative-direction.
    - name: performance
      grade: B
      ship_critical: false
      evidence: >-
        Good hygiene: hot paths indexed (0001/0008/0020 cover reprojectStock/getPantryView/digest/reorder/
        cohort); no N+1 (getCohortRetention is one 12-week CTE; engines take pre-fetched inputs); LLM cheap-first
        ladder wired (models.ts TIER_ORDER + client.ts verify-then-escalate). Client bundles reasonable (102 kB
        shared, heaviest route 109 kB). GAPS (hold it at B): (1) the 88.5 kB middleware figure is gzip of an
        UNCHANGED 276 KB uncompressed edge bundle (next-auth/jose pulled into edge on nearly every request) —
        a reporting artifact, not a real reduction; (2) still NO CI perf-budget gate (grep of .github/workflows
        for bundlesize|lighthouse|size-limit = 0), so bundle regressions aren't mechanically caught.
  # Ordered by ship-criticality then leverage. No ship-critical dim is below A this cycle.
  top_gaps:
    - dimension: tests_evals
      ship_critical: false
      gap: >-
        Add a vision-quality eval for the scan-detection stage (detect.ts): golden fixture images + an
        LLM-judge (or fixed-truth) score on item-count / precision with a pass-rate threshold, mirroring the
        existing extraction/meal-gen .eval.test.ts pattern. Today detect.ts is only unit-tested with a stubbed
        client — the flagship "pantry fills itself" vision stage has no quality measurement. This is the sole
        remaining tests_evals gap (vision + logCook coverage are now closed).
    - dimension: performance
      ship_critical: false
      gap: >-
        (a) Add a CI perf-budget gate (size-limit / bundlesize / lighthouse-ci) enforcing middleware and
        per-page first-load ceilings so bundle regressions fail the build. (b) Trim the 276 KB uncompressed
        edge middleware — move the next-auth/jose session read off the edge runtime or narrow the middleware
        matcher — the gzip-reporting change masked that the bundle is unchanged since baseline.
    - dimension: launch_readiness
      ship_critical: true
      gap: >-
        A→A+ polish only (already at the ship bar): the RevenueCat webhook event-mapping logic
        (tierFromProduct / GRANT_EVENTS / REVOKE_EVENTS in webhooks/revenuecat/route.ts) has no dedicated
        keyless unit test — a product-id naming change could ship un-caught. Add a pure-function unit test on
        the event→tier mapping. Not blocking; every other launch artifact is real.
    - dimension: correctness_reliability
      ship_critical: true
      gap: >-
        A→A+ polish only (already at the ship bar): generateWithVerify's real multi-tier escalate-then-exhaust
        loop (client.ts:292-293) is exercised only indirectly via a fake in llm-normalizer.test.ts. Add a direct
        unit test of the real tier-advance + circuit-breaker path. Not a defect; both baseline gaps are closed.
```

## Notes for the factory loop (consume, don't self-grade)

- **Ship gate is MET for the first time.** All five ship-critical dimensions are at **A**; the two
  baseline blockers (mobile IAP, vision write/coverage) are fixed and regression-guarded. Overall **A**.
- **The two remaining B's are both non-ship-critical and independent.** `tests_evals` needs one thing:
  a vision-quality eval on `detect.ts`. `performance` needs a CI perf-budget gate + an edge-middleware
  trim. Neither blocks submission; closing both is the path to overall A+.
- The `performance` grader caught that the apparent middleware 276→88.5 kB "reduction" is only a
  gzip-vs-uncompressed reporting change (Next.js 15.5 now reports gzipped) — the edge bundle is
  **unchanged**. Don't read the smaller number as a win.
- Two bounded A→A+ polish items on already-A ship-critical dims are listed above (RevenueCat event-map
  unit test; direct generateWithVerify escalate-loop test). Optional gold-avoidance: build only if cheap.
