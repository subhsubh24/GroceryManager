# GroceryManager — Quality Scorecard

> **Independent grade** assigned by the separate Quality Auditor routine (maker ≠ checker). The
> factory loop CONSUMES this as a DATA signal and never authors/overwrites it. Every grade below is
> backed by a mechanical signal the grader actually ran this cycle, plus file/line evidence. Grades
> may not exceed what the signals support. See `QUALITY_RUBRIC.md` for the scale and dimensions.

**As of 2026-07-03.** Overall: **A**. Ship gate: **MET** — every ship-critical dimension
(`functional_reality`, `correctness_reliability`, `security`, `design_taste`, `launch_readiness`) is
at **A**, and every other dimension is **≥ B**. This cycle `tests_evals` rose **B → A**: the sole
standing gap (no vision-quality eval on the scan-detection stage) is CLOSED by the new
`scan.eval.test.ts` (real-fixture recall **and** anti-hallucination precision on live Gemini, #386).
**8 of 9 dimensions are now at A** — the highest grade the product has held. The only remaining
below-A dimension is `performance` (**B**, non-ship-critical): still no CI perf-budget gate and an
unchanged 279,931-byte edge middleware. Overall is held at **A** (not A+) by that one B.

```yaml
QUALITY_SCORECARD:
  as_of: 2026-07-03
  overall: A
  ship_gate_met: true
  graded_by: independent-quality-auditor   # maker != checker; one fresh adversarial subagent per dimension
  mechanical_signals:
    typecheck: pass                          # pnpm -r run typecheck → exit 0 (all packages Done)
    core_tests: pass                         # pnpm --filter @gm/core test → exit 0; 93 files pass / 10 skipped; 844 tests pass / 26 skipped; coverage lines 86.82 / branches 87.46 / functions 90.39 (thresholds ~70/84/76/70 met)
    prod_build: pass                         # NODE_ENV=production next build → exit 0; no missing-export warnings; 102 kB shared first-load; middleware reported 88.5 kB (gzip of an unchanged 279,931-byte raw edge bundle)
  dimensions:
    - name: functional_reality
      grade: A
      ship_critical: true
      evidence: >-
        Every journey wired to real server actions + DB writes, no dead-ends/fake data. signup/page.tsx:27-83
        (createUserWithPassword→signIn→/onboarding, no verify wall); page.tsx:88-130 (home = withTenant reads,
        degrades to EMPTY_HOME_DATA with honest empty states, explicit no-fake-data comments 141-146); cook loop
        real end-to-end (cook-actions.ts:23-63 → log-cook.ts:58-211 writes MealLog + decrements via
        appendLedgerAndReproject 176-188); ingestion real (add-receipt/actions.ts:44-113, full normalization in
        withTenant, best-effort degrade). Ledger invariant holds exactly — sole production pantry_stock
        INSERT/UPDATE is reprojectStock (persist.ts:128-134); queries.ts only DELETEs (1501,1513). e2e
        journeys.spec.ts outcome-asserts: signup→working dashboard (never the error boundary, sign-out +
        getting-started 52-60), sign-in, onboarding-through-completion, every nav target, paywall shows real $.
    - name: correctness_reliability
      grade: A
      ship_critical: true
      evidence: >-
        Independently re-verified, no correctness bug. EWMA guards <2 purchases (depletion.ts:80) + skips
        non-positive intervals (87); spoilage re-grounds from later of purchase/confirmation (124-127), expires
        only past shelfLifeDays+graceDays (134), zero-delta confirmations excluded (114-118). Vision persist
        routes every mutation through appendLedgerAndReproject, never touches pantry_stock (vision/persist.ts:102,156);
        persist.unit.test.ts:97-100 makes db.update throw so any regression is loud. generateWithVerify try/catches
        each attempt (client.ts:288), escalates tiers (292-293), circuit-breaks → VerificationExhaustedError;
        withTimeout fails fast (150-170); receipt parse caught (add-receipt/actions.ts:110); estimateMealMacros
        non-throwing (nutrition/estimate.ts:135-138). #378 (fail-closed HMAC), #379 (workers fail-loud), #380
        (loud captcha log) are correct hardening, not regressions.
    - name: security
      grade: A
      ship_critical: true
      evidence: >-
        All 38 api/ routes enumerated, ZERO unauth'd per-user data surface. Mobile surfaces use verifyMobileToken
        (HMAC, timing-safe, exp-checked, null→fail-closed when AUTH_SECRET absent, mobile/_lib.ts:22); v1 uses
        jose jwtVerify aud gm-mobile, throws when NEXTAUTH_SECRET unset (v1/lib/mobile-auth.ts:9). All per-user DB
        access in withTenant (GUC + non-UUID refusal, client.ts:78-83) over deny-by-default RLS (0002_rls.sql).
        Webhooks fail closed: Stripe constructEvent (webhooks/stripe:34-52), RevenueCat SHA-256 timingSafeEqual
        identical-401 (webhooks/revenuecat:52-70), Gmail denies in prod when secret absent (webhooks/gmail:21).
        #378 confirmed fail-closed — the only fallback secrets (growth/optin.ts:43, email/index.ts:57) are
        non-auth email/opt-in tokens that throw in prod; no auth path uses a hardcoded secret. Logins hashed +
        rate-limited (10/15min); entitlement webhook-written + read server-side, never client-trusted; hand-rolled
        JWT recomputes HS256 (not alg-confusion vulnerable).
    - name: design_taste
      grade: A
      ship_critical: true
      evidence: >-
        Real token system, not default Tailwind: globals.css:5-99 variable-backed RGB ramps (brand/ink/success/
        warn/danger + cream/surface/line) with full dark-mode inversion + contrast-holding --brand-solid;
        tailwind.config.ts:139-145 bespoke display-sm→xl type scale, one typeface (Hanken Grotesk). AI-slop
        neutralized not merely unused — legacy citrus/berry/grape ramps resolve to single-stop solid brand fills
        (config:167-177), glows collapse to one shadow scale; only literal tsx hex are the two theme-color meta
        tags (layout.tsx:57-58). a11y: 16px mobile inputs (globals.css:445-451), :focus-visible ring (131), 44px
        targets real (#354 save-heart min-h/min-w-[44px] + hit-slop), aria-labels across 25 files, safe-area
        insets. Honest empty states (pantry/page.tsx:354-358 Lucide Package icon). Only emoji live in wrapped
        shareText() (OS share string, not UI chrome).
    - name: launch_readiness
      grade: A
      ship_critical: true
      evidence: >-
        Mobile IAP is a real purchase flow: purchases.ts:103-113 Purchases.purchasePackage() + hasPremiumEntitlement
        (67-69), restore() (116-125), degrades via isPurchasesConfigured() (37-39); upgrade.tsx:82-103 onBuy→purchase
        →setPremium(active), inert "coming soon" only when unconfigured (212-221). RevenueCat webhook fails closed
        timing-safe (route.ts:51-69) + maps GRANT/REVOKE into the same PreferenceSignal ledger as Stripe (90-138).
        Account deletion real both surfaces (api/mobile/account → deleteUserAndAllData behind auth+confirm+rate-limit;
        ON DELETE CASCADE across 0005/0011/0017/0018/0019). Store assets genuine (icon 1024², feature graphic
        1024×500), prod release config placeholder-free (eas.json production + app.config.ts env-driven versions),
        privacy/terms substantive (store/privacy-disclosures.md 17KB, LAUNCH.md 21KB).
    - name: tests_evals
      grade: A
      ship_critical: false
      evidence: >-
        Last cycle's SOLE named gap — no vision-quality eval on the scan stage — is genuinely CLOSED. scan.eval.test.ts:75
        calls the REAL detectPantryItems (live Gemini, detect.ts:76) against two committed genuine JPEG fridge
        photos (fixtures/images/*.jpg, Wikimedia CC BY-SA/BY, ATTRIBUTION.md:8-9 — not synthetic), asserting BOTH
        recall (94, passRate≥0.8) AND a separate anti-hallucination precision bar over conservative absent items
        (105,124) — the exact failure mode detect.ts's per-item bounding-box prompt suppresses. Wired end-to-end:
        evals.yml (nightly cron, GEMINI_API_KEY-guarded) → run-evals.sh → RUN_EVALS=1 vitest; describe.skipIf(!RUN)
        gated, transient 429/503 → ctx.skip() not false pass. Other 5 evals retain golden fixtures + 0.8 floors;
        all 26 skips honest env gates (skipIf !DB / !RUN_EVALS), evaluate.mjs:94-100 rejects undeclared test.skip.
        Coverage floor enforced + met (lines 86.82 / functions 90.39).
    - name: artifact_integrity
      grade: A
      ship_critical: false
      evidence: >-
        check-self-validation.mjs → exit 0; --readiness → exit 0 (unmet [], unmet_unsurfaced []; 5/5 active
        capabilities validated). Each declared artifact genuinely exercises its capability: billing/index.test.ts
        (canUse/isPremium gating), rate-limit-guard.test.ts:21-31 (bypass HARD-refuses in prod), email.test.ts:254-292
        (capture sink + unsubscribe fail closed), e2e/email-roundtrip.spec.ts:48-88 (real submit→sink→confirm +
        tampered-token negative), journeys.spec.ts (outcome-asserting). CI wires both e2e specs (ci.yml:215,224) +
        sets EMAIL_CAPTURE_DIR (178,207, declared in manifest) so the round-trip can't vacuously skip. Pricing
        consistent: billing/index.ts (499/3999/999/7999) == BUSINESS_CASE.md:44-46 == upgrade/page.tsx:137-197. New
        scan.eval is a RUN_EVALS-gated core eval (not an e2e capability spec), hides no undeclared skip; no
        capability parked planned/retired to dodge the tripwire.
    - name: business_case
      grade: A
      ship_critical: false
      evidence: >-
        Honest: floor_met_year1 false (BUSINESS_CASE.md:13; base steady-state ≈$33K < $100K floor); doc documents
        its own prior gaming correction (23-31: old 60%×21%=12.6% signup→paid re-grounded to a cited 4% freemium
        rate, within the 2-5% Amplitude band, 153). Prices code-sourced (billing/index.ts:40,56,66-67 = 499/3999/
        999/7999). Independently recomputed and reconciles: net ARPU $3.82, base 730 payers → $33.4K ARR, floor
        needs ~1,929-2,182 payers ≈ 4,000-4,500 dl/mo. Growth levers BUILT: z-test (growth/experiments/stats.ts:46-71),
        6-month-capped referral ladder (referral/rewards.ts:30-36), lifecycle emails + H14/H15 crons, cohort
        retention, UTM (0013_utm_tracking.sql). Freemium split correction landed (#355): PREMIUM_FEATURES
        (billing/index.ts:83-91) matches the doc; no gamed numbers reappeared.
    - name: performance
      grade: B
      ship_critical: false
      evidence: >-
        Good hygiene keeps it off C: hot paths indexed (0008_perf_indexes user/canonical FKs; 0020_cohort_activity_index:8,12
        composite meal_logs(user_id,cooked_at) + users(created_at); 0001 trgm/HNSW); getCohortRetention is one
        db.execute CTE with in-memory rows.map, no N+1; LLM cheap-first ladder (llm/models.ts:4 TIER_ORDER
        cheap→mid→reasoning); client bundles reasonable (102 kB shared). GAPS (hold it at B, unchanged from #320):
        (1) NO CI perf-budget gate — grep of .github/workflows/*.yml for bundlesize|lighthouse|size-limit|budget =
        0 real matches, so bundle regressions aren't mechanically caught; (2) edge middleware still 279,931 bytes
        raw (middleware.ts:1,6 imports NextAuth/jose onto the edge runtime, broad matcher :114 runs on nearly every
        non-static request) — the reported 88.5 kB is only the gzip figure, not a trim.
  # Ordered: the sole below-A dimension first (the only thing off overall-A+), then bounded A→A+ polish on already-A ship-critical dims.
  top_gaps:
    - dimension: performance
      ship_critical: false
      gap: >-
        (a) Add a CI perf-budget gate (size-limit / bundlesize / lighthouse-ci) enforcing middleware and per-page
        first-load ceilings so bundle regressions fail the build (.github/workflows/*.yml has none). (b) Trim the
        279,931-byte edge middleware — move the next-auth/jose session read off the edge runtime or narrow the
        middleware matcher (middleware.ts:1,6,114). This is the ONLY dimension below A and the only thing holding
        overall off A+; non-ship-critical, does not block the (met) ship gate. Tracked in issue #320.
    - dimension: launch_readiness
      ship_critical: true
      gap: >-
        A→A+ polish only (already at the ship bar): the RevenueCat event→tier mapping (tierFromProduct /
        GRANT_EVENTS / REVOKE_EVENTS, webhooks/revenuecat/route.ts:44-49) is still inline+unexported with NO unit
        test — a product-id naming change or grant/revoke reclassification could ship un-caught. Extract + add a
        pure-function unit test on the event→tier mapping. Unchanged from last cycle; not blocking.
    - dimension: correctness_reliability
      ship_critical: true
      gap: >-
        A→A+ polish only (already at the ship bar): generateWithVerify's real multi-tier escalate-then-exhaust loop
        (client.ts:292-293) is exercised only indirectly via a fake in llm-normalizer.test.ts. Add a direct unit
        test of the real tier-advance + circuit-breaker path. Not a defect; optional gold-avoidance.
```

## Notes for the factory loop (consume, don't self-grade)

- **Ship gate remains MET; the product is at its strongest — 8 of 9 dimensions at A.** `tests_evals`
  closed its last gap this cycle (the vision scan-quality eval on `detect.ts`, #386), moving B → A.
- **`performance` (B) is now the ONLY thing between the product and overall A+.** It is non-ship-critical
  (≥ B satisfies the gate) but is the single highest-leverage improvement. Two concrete asks: a CI
  perf-budget gate + a real edge-middleware trim. Issue #320 tracks it (still open, still accurate).
- **Do not read the 88.5 kB middleware figure as a reduction.** It is the Next 15.5 gzip report of an
  **unchanged** 279,931-byte raw edge bundle (next-auth/jose on the edge). Verified again this cycle.
- Two bounded A→A+ polish items on already-A ship-critical dims are listed (RevenueCat event-map unit
  test; direct `generateWithVerify` escalate-loop test). Optional gold-avoidance — build only if cheap.
