# GroceryManager — Quality Scorecard

> **Independent grade** assigned by the separate Quality Auditor routine (maker ≠ checker). The
> factory loop CONSUMES this as a DATA signal and never authors/overwrites it. Every grade below is
> backed by a mechanical signal the grader actually ran this cycle, plus file/line evidence. Grades
> may not exceed what the signals support. See `QUALITY_RUBRIC.md` for the scale and dimensions.

**As of 2026-07-05.** Overall: **A**. Ship gate: **MET** — every ship-critical dimension
(`functional_reality`, `correctness_reliability`, `security`, `design_taste`, `launch_readiness`) is
at **A**, and every other dimension is **≥ B**. **No change from last cycle (2026-07-03):** 8 of 9
dimensions remain at **A**; the sole below-A dimension is still `performance` (**B**,
non-ship-critical), unchanged from #320 (no CI perf-budget gate; edge middleware still 279,931 bytes
raw). Overall is held at **A** (not A+) by that one B. The 48 commits since the last grade were
bookkeeping + hardening (uncaught-throw → degrade, store-404 alias, a11y contrast, mobile brand
color, new unit tests) — verified as genuine improvements, none a regression, none closing the
performance gap.

```yaml
QUALITY_SCORECARD:
  as_of: 2026-07-05
  overall: A
  ship_gate_met: true
  graded_by: independent-quality-auditor   # maker != checker; one fresh adversarial subagent per dimension
  mechanical_signals:
    typecheck: pass                          # pnpm -r run typecheck → exit 0 (all packages Done)
    core_tests: pass                         # pnpm --filter @gm/core test → exit 0; 94 files pass / 10 skipped; 871 tests pass / 26 skipped; coverage lines 87.04 / branches 87.63 / functions 90.66 (thresholds 70/84/76/70 met)
    prod_build: pass                         # NODE_ENV=production next build → exit 0; no missing-export warnings; 102 kB shared first-load; middleware reported 88.5 kB (gzip of an unchanged 279,931-byte raw edge bundle — byte-identical to last cycle)
  dimensions:
    - name: functional_reality
      grade: A
      ship_critical: true
      evidence: >-
        Every journey traces to real server actions + DB writes, no dead-ends/fake data. signup/page.tsx:62-80
        (createUserWithPassword→signIn→/onboarding, no verify wall); page.tsx:88-130 (home = one withTenant tx over
        real pantry/list/digest rows, degrades to all-zero EMPTY_HOME_DATA; marketing HERO_PREVIEW gated to
        logged-out branch :457). Cook loop real end-to-end: logCookedRecipe (lib/cook-actions.ts:39-53) → logCook
        writes mealLogs + appendLedgerAndReproject per ingredient delta (recipe/log-cook.ts:141-188), never touches
        pantry_stock. Ingestion real (add-receipt/actions.ts:76-91 → ingestion/ingest.ts:79-151 inserts purchases/
        line-items + purchase ledger event, Gmail-message idempotent). e2e journeys.spec.ts:52-60,34-38 outcome-
        assert: reach a working dashboard, FAIL on ERROR_SCREEN + VERIFY_DEADEND email-wall, step through every
        onboarding step. All 40 "placeholder/coming soon" grep hits benign (input placeholders, loading skeletons,
        honest waitlist banner, billing-disabled buttons with accurate aria-label).
    - name: correctness_reliability
      grade: A
      ship_critical: true
      evidence: >-
        Ledger-only invariant holds: sole production pantry_stock write is the upsert at pantry/persist.ts:128-134;
        every other mutator (vision/persist.ts:102,156; waste-persist.ts:37) routes through appendLedgerAndReproject,
        all other refs are DELETE or tests. Depletion guarded: ewmaConsumptionRate null <2 purchases (depletion.ts:80),
        skips non-positive intervals (:87), zero-delta confirmations excluded from reference point + bought date
        (:114, persist.ts:84), spoilage re-grounds from freshFrom=later(purchase,confirmation) (:124-127), expiry only
        past shelfLifeDays+graceDays (:134). LLM degrades: generateWithVerify try/catches each tier, escalates via
        nextTier, circuit-breaks → VerificationExhaustedError (client.ts:274-296); withTimeout fails fast 8s (:150-170);
        receipt parse isolated per-message (gmail-sync.ts:253); nutrition double-wraps to EMPTY_MACROS/null. Spot-checked
        hardening #436/#437: genuine degrades, and acceptInviteAction keeps redirect() OUTSIDE try/catch
        (household/join/[token]/actions.ts:33-41) — avoids swallowing Next's redirect throw. Ran targeted
        depletion+persist.unit tests: 42 pass.
    - name: security
      grade: A
      ship_critical: true
      evidence: >-
        All 39 api/ route.ts audited, ZERO unauth'd per-user data surface. 18/19 mobile/* call verifyMobileToken
        (HMAC-SHA256, timingSafeEqual + length guard, exp-checked, null→fail-closed when AUTH_SECRET absent,
        mobile/_lib.ts:17); the exception is the login endpoint issuing tokens. v1/* use jose jwtVerify aud gm-mobile,
        throw when NEXTAUTH_SECRET unset (v1/lib/mobile-auth.ts:9). Web routes gate on currentUserId()+withTenant;
        all DB access in withTenant (non-UUID refusal client.ts:79) over deny-by-default RLS on a non-owner
        grocery_app role (0002_rls.sql:30-61). Webhooks fail closed: Stripe constructEvent (:50), RevenueCat SHA-256
        timingSafeEqual identical-401 (:64), Gmail timing-safe (dev-only bypass gated on NODE_ENV). Every cron/*
        checks CRON_SECRET; growth/* require CRON_SECRET bearer OR ADMIN_EMAIL session. No client-supplied userId
        trust, no hardcoded auth-secret fallbacks (email/opt-in tokens throw in prod). Rate limits on login (10/15min),
        signup (5/hr), delete, paid APIs; credentials lockout (auth.ts:72). CSP+HSTS+X-Frame-Options:DENY, no
        wildcard/credentialed CORS (next.config.mjs:15-56). Hand-rolled HMAC recomputes HS256 (not alg-confusion).
    - name: design_taste
      grade: A
      ship_critical: true
      evidence: >-
        Hand-built token system, not Tailwind default: globals.css:5-99 variable-backed RGB ink/brand ramps that
        INVERT ink + lighten brand in .dark, with a fixed --brand-solid (12 138 62) kept dark for white-on-green
        contrast both themes; tailwind.config.ts:139-160 bespoke display-sm→xl type scale on one typeface (Hanken
        Grotesk), restrained low-opacity shadow scale (no glows). Honest empty states: every .empty-emoji block
        renders a real Lucide glyph (recipes ChefHat, list Check), the class name a legacy misnomer not emoji. a11y
        deliberate: one global :focus-visible ring (:131), forced 16px inputs <640px (:445-451), min-h-[44/48px]
        targets, safe-area insets on .page/.glass-nav, aria-labels across 25 files; cook-mode.tsx:169-180 documents
        choosing brand-solid-hover BECAUSE brand-solid fails WCAG AA on white. #438 aligns the Expo header/spinner to
        canonical #0c8a3e (native can't use CSS vars — hex correct there). Only UI emoji live in wrapped shareText()
        (OS share strings, sanctioned). Dead legacy gradient/citrus/berry tokens still declared but all resolve to
        solid brand — none render.
    - name: launch_readiness
      grade: A
      ship_critical: true
      evidence: >-
        Mobile IAP real, not a stub: purchases.ts:103-113 Purchases.purchasePackage()+hasPremiumEntitlement,
        restore() (:116-125), degrades via isPurchasesConfigured() (:37-39); upgrade.tsx:82-103 onBuy→purchase→
        setPremium(true), inert "coming soon" only when unconfigured (:212-221). RevenueCat webhook fails closed
        SHA-256 timingSafeEqual 401 when secret unset (route.ts:64-69) + maps GRANT/REVOKE into the same
        appendPreferenceSignal ledger as Stripe (:90-138, parity vs stripe/route.ts:119-153). Account deletion real
        both surfaces (api/mobile/account:15-47 auth+confirm+rate-limit; profile/page.tsx:71-79 → deleteUserAndAllData,
        ON DELETE CASCADE in 0005/0011/0017/0018/0019). Store assets real PNGs (icon-1024 1024², feature-graphic
        1024×500), privacy/terms 154/155 lines; /support redirect("/help") (#435 present). eas.json production profile
        + app.config.ts env-driven versions placeholder-free; vercel.json crons.
    - name: tests_evals
      grade: A
      ship_critical: false
      evidence: >-
        Flagship vision eval real: scan.eval.test.ts:75 calls live detectPantryItems against two genuine open-licensed
        fridge photos (fixtures/images/*.jpg + ATTRIBUTION.md), enforcing BOTH a recall floor (:94 passRate≥0.8) AND a
        separate anti-hallucination precision floor over deliberately-absent items (:97-124). All 6 *.eval.test.ts
        instantiate the real GeminiClient + gate on 0.8 floor, wired to nightly RUN_EVALS=1 key-guarded evals.yml cron
        that opens a regression issue on failure (:56-71). Coverage thresholds vitest.config.ts:13-17 (lines 70/
        branches 84/functions 76/stmts 70) enforced in required CI job (ci.yml:57) and met (87.04/87.63/90.66) — not
        ~0. All 13 skipIf/describe.skip are honest env gates (!RUN_EVALS, !DB, !CAPTURE_DIR); evaluate.mjs:94-100
        blocks undeclared env-gated test.skip. #419 pins Φ(1.96)≈0.975 + Wilson CI + monotonicity guard; #430 asserts
        2-hop item_base qty = product of factors, confidence=MIN — neither vacuous.
    - name: artifact_integrity
      grade: A
      ship_critical: false
      evidence: >-
        check-self-validation.mjs → exit 0 ("every active capability is self-validated in CI"); --readiness → exit 0
        (unmet [], unmet_unsurfaced []; 5/5 active capabilities). Each declared artifact genuinely exercises its
        capability: billing/index.test.ts:78-83 (family pricing 999/7999 == billing/index.ts:66-67),
        rate-limit-guard.test.ts:21-31 (bypass throws in prod), email.test.ts:254-264 (capture sink fails closed in
        prod), email-roundtrip.spec.ts (real submit→sink→confirm + tampered-token reject; only .skip gates on
        EMAIL_CAPTURE_DIR, declared manifest:27-29 + set ci.yml:178 + run :224). Pricing consistent across
        upgrade/page.tsx:137-197 ($4.99/39.99/9.99/79.99) == BUSINESS_CASE.md:44-49 == billing/index.ts. #423 README
        rewrite checks out (mobile app/ has the named screens; index.tsx no longer imports scaleMeasure; purchases.ts
        is the RevenueCat wrapper). No capability parked planned/retired to dodge the tripwire.
    - name: business_case
      grade: A
      ship_critical: false
      evidence: >-
        Honest: floor_met_year1 false (BUSINESS_CASE.md:11; base steady-state ≈$33K < $100K floor); doc documents its
        own prior gaming correction (gamed 12.6% trial_start×trial→paid re-grounded to the cited 4% freemium free→paid).
        Independently recomputed all three scenarios and they reconcile: base 1500×0.45×0.04=27/mo ÷0.037 → 730 users
        ×$3.82×12 = $33,463 (doc $33,450 ✓); conservative $3.1K ✓; optimistic $342K ✓ — no gamed arithmetic, 4% is
        transparently labeled upper-mid of the cited 2-5% band. Prices code-sourced (billing/index.ts:40,56,66-67 =
        499/3999/999/7999, exact match to doc). Growth levers BUILT: two-proportion z-test + Wilson CI + power-based
        min sample (stats.ts:46-159 with a documented sign-bug fix), 6-month-capped referral ladder (referral/rewards.ts:
        30-36), H14/H15 lifecycle emails + live crons, cohort retention, UTM (0013_utm_tracking.sql). PREMIUM_FEATURES
        (index.ts:83-91) matches the doc verbatim.
    - name: performance
      grade: B
      ship_critical: false
      evidence: >-
        Good hygiene keeps it off C: hot paths indexed (stockLedger composite ledger_user_item_idx(user_id,
        canonical_item_id) schema.ts:466 covers reprojectStock; 0020 meal_logs_user_cooked_at_idx + users_created_at_idx;
        0001 trgm GIN + HNSW); getCohortRetention (cohort-retention.ts:70-115) is one set-based CTE bounded to
        COHORT_WEEKS=12, no N+1; LLM cheap-first ladder (llm/models.ts:4 TIER_ORDER cheap→mid→reasoning); client bundles
        reasonable (102 kB shared). GAPS (hold it at B, unchanged from #320): (1) NO CI perf-budget gate — grep of
        .github/workflows/*.yml for bundlesize|lighthouse|size-limit|budget = only two prose comments about e2e
        per-request timeouts (ci.yml:186, evals.yml:28), no real gate, so bundle regressions aren't mechanically caught;
        (2) edge middleware still 279,931 bytes raw (byte-identical to last cycle; middleware.ts:1,6 imports NextAuth →
        jose on the edge runtime, broad matcher :112-114 runs on nearly every non-static request) — the reported
        88.5 kB is only the gzip figure, not a trim.
  # Ordered: the sole below-A dimension first (the only thing off overall-A+), then bounded A→A+ polish on already-A ship-critical dims.
  top_gaps:
    - dimension: performance
      ship_critical: false
      gap: >-
        (a) Add a CI perf-budget gate (size-limit / bundlesize / lighthouse-ci) enforcing middleware and per-page
        first-load ceilings so bundle regressions fail the build (.github/workflows/*.yml has none — only e2e-timeout
        comments). (b) Trim the 279,931-byte edge middleware — move the next-auth/jose session read off the edge
        runtime (lightweight edge-safe JWT decode) or narrow the matcher (middleware.ts:1,6,112-114). This is the ONLY
        dimension below A and the only thing holding overall off A+; non-ship-critical, does not block the (met) ship
        gate. Tracked in issue #320 (still open + accurate).
    - dimension: launch_readiness
      ship_critical: true
      gap: >-
        A→A+ polish only (already at the ship bar): the RevenueCat event→tier mapping (tierFromProduct /
        GRANT_EVENTS / REVOKE_EVENTS, webhooks/revenuecat/route.ts:32-49) is still inline + unexported with NO unit
        test — a product-id naming change or grant/revoke reclassification could ship un-caught. Extract to an exported
        pure fn + add a table test. Unchanged from last two cycles; not blocking.
    - dimension: design_taste
      ship_critical: true
      gap: >-
        A→A+ polish only (already at the ship bar): cook/[id]/cook-mode.tsx:181,190 use raw Unicode glyphs ("✓ Done — log
        it", "Next →") as inline UI-chrome icons instead of the lucide registry's Check / ArrowRight — a small violation
        of "icons via the registry, never a bare glyph." One non-primary screen, near-invisible dingbats; trivial,
        non-blocking. Swap to registry icons.
```

## Notes for the factory loop (consume, don't self-grade)

- **Ship gate remains MET; grade unchanged from 2026-07-03 — 8 of 9 dimensions at A.** No
  ship-critical regression across the 48 intervening commits (all bookkeeping + hardening + tests,
  verified as genuine improvements).
- **`performance` (B) is STILL the ONLY thing between the product and overall A+.** Non-ship-critical
  (≥ B satisfies the gate) but the single highest-leverage improvement. Two concrete asks unchanged
  since baseline: a CI perf-budget gate + a real edge-middleware trim. Issue #320 tracks it (open,
  accurate).
- **Do not read the 88.5 kB middleware figure as a reduction.** It is the Next 15.5 gzip report of an
  **unchanged** 279,931-byte raw edge bundle — verified byte-identical to last cycle this run.
- Two bounded A→A+ polish items on already-A ship-critical dims are listed (RevenueCat event-map unit
  test; two raw glyphs in cook-mode). Optional gold-avoidance — build only if cheap.
