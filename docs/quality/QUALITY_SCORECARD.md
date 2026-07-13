# GroceryManager — Quality Scorecard

> **Independent grade** assigned by the separate Quality Auditor routine (maker ≠ checker). The
> factory loop CONSUMES this as a DATA signal and never authors/overwrites it. Every grade below is
> backed by a mechanical signal the grader actually ran this cycle, plus file/line evidence. Grades
> may not exceed what the signals support. See `QUALITY_RUBRIC.md` for the scale and dimensions.

**As of 2026-07-13.** Overall: **A**. Ship gate: **MET** — every ship-critical dimension is A/A+ and
every other dimension is ≥ B. **The gate is RE-CLOSED:** last cycle (07-11) the ship-critical
`design_taste` dropped to **B** because the native `apps/mobile` app had no icon system (~110 raw
Unicode glyphs standing in for icons), which broke the gate. **This cycle the factory genuinely fixed
it:** #522 added an Ionicons icon system (`apps/mobile/lib/icons.tsx`, mirroring the web registry) and
replaced the raw-glyph chrome, and #548 removed the last raw glyph (`★` → `Star` icon) on the paywall.
An adversarial UTF-8 raw-glyph sweep of `apps/mobile/app` now returns **zero** structural offenders —
`←`/`→`/`›`/`✓`/`★` are all real icon components; the only residual `→` hits are trailing inline
text-arrows in CTA labels ("See plans →"), a defensible typographic convention (A→A+ nit, not a bug).
The residual web `▾` nit is also closed (`cook/[id]/page.tsx:182` now renders `<ChevronDown>`). So
`design_taste` rises **B → A** and the gate is met. Everything else held: `functional_reality` **A+**,
three ship-critical dims **A**, three non-ship-critical dims **A**, `performance` **B** unchanged (no CI
perf-budget gate; edge middleware byte-identical at 280,299).

```yaml
QUALITY_SCORECARD:
  as_of: 2026-07-13
  overall: A
  ship_gate_met: true           # all 5 ship-critical dims A/A+ (design_taste re-closed B→A this cycle); non-SC performance is B (≥B satisfies the gate)
  graded_by: independent-quality-auditor   # maker != checker; one fresh adversarial subagent per dimension
  mechanical_signals:
    typecheck: pass                          # pnpm -r run typecheck → exit 0 (all packages Done)
    core_tests: pass                         # pnpm --filter @gm/core test → exit 0; 105 files pass / 11 skipped; 1028 tests pass / 27 skipped (up from 977); coverage lines 88.46 / branches 88.2 / functions 90.72 / stmts 88.46 (thresholds 70/84/76/70 met)
    prod_build: pass                         # NODE_ENV=production next build → exit 0; no missing-export warnings; 102 kB shared first-load; middleware reported 88.6 kB (gzip of a 280,299-byte raw edge bundle — BYTE-IDENTICAL to last cycle: no creep, no trim)
    self_validation: pass                    # node scripts/check-self-validation.mjs → exit 0 (8 capabilities, 8 active, all keyless-validated); --readiness → exit 0 (unmet [], unmet_unsurfaced [])
  dimensions:
    - name: functional_reality
      grade: A+
      ship_critical: true
      evidence: >-
        Re-proven, not inherited. Fake-data grep over apps/web/app/**/*.tsx (lorem/mockdata/dummy/faker/
        Math.random/placeholder-price/hardcoded) returned ZERO hits (the only Math.random is e2e test-username
        entropy, journeys.spec.ts:27). Cook loop traces to the ledger with no direct stock write: cook/[id]/
        page.tsx:89-103 logCook inside withTenant → log-cook.ts:176-188 applies each delta via
        appendLedgerAndReproject (eventType consume_recipe), the only pantryStock reference being a .select() of
        the learned rate; macros clamped (clampMacros:140) + computed outside the tx (.catch→undefined) so a failed
        FDC/LLM call still logs the cook with null macros. Signup has no verify dead-end (signup/page.tsx:91 signs
        in with redirectTo:/onboarding; journeys.spec.ts:36-38 guards the VERIFY_DEADEND regex). e2e assertions are
        real OUTCOMES: dashboard renders sign-out + getting-started and NEVER the error boundary (:57-59), steps
        every onboarding step (:102-135), asserts a real $ paywall price (:149), and the public receipt endpoint
        degrades to well-formed JSON in [200,429,502,503] not a 500/fake pantry (:198-207). Throw-safe auth holds
        (tenant.ts:13-40 catch auth() throwing → signed-out; page.tsx:88-129 → EMPTY_HOME_DATA on !userId/any throw).
        Zero findings, defensive depth beyond the bar → A+.
    - name: correctness_reliability
      grade: A
      ship_critical: true
      evidence: >-
        Targeted signal: pnpm --filter @gm/core test → 1028 pass / 27 skip / 0 fail (skips are RLS/vision
        integration + LLM evals gated on external keys — expected keyless behavior). Ledger-only invariant HOLDS:
        the SOLE production pantry_stock write is the upsert at persist.ts:128-134 (insert.onConflictDoUpdate) inside
        reprojectStock; every other reference is a read or a test; waste-persist.ts:37 + log-cook.ts:176-188 mutate
        only through appendLedgerAndReproject. Depletion edges all guarded (depletion.ts): <2 purchases→null (:80),
        days<=0 skip (:87), zero-delta exclusion via nonZeroEvents (:114), grace window (:134), max(0) clamp (:137),
        decayConfidence clamp [0.1,1] + tau<=0 guard (:67-68), run-out = min(consume,spoil) null-safe (:156-161).
        LLM degrades never blocks: generateWithVerify escalate ladder inside try/catch (client.ts:306-326), bounded
        by withTimeout (:162-166) + maxAttempts circuit-break; nutrition → EMPTY_MACROS on any throw (estimate.ts:135
        -137); MediaGenClient audit-first + no-key unavailable degrade. A→A+ nit: media-gen.ts:168 re-invokes the
        pure deterministic auditMediaAsset(req) when building the ok payload (duplicating the preflight at :138) — a
        wasted recompute yielding the identical passing result, zero correctness impact but non-zero → caps at A.
    - name: security
      grade: A
      ship_critical: true
      evidence: >-
        41 api route.ts enumerated; ZERO unauth'd per-user data surface. All 16 mobile data routes verifyMobileToken
        → withTenant (mobile/pantry/route.ts:15,24; _lib.ts:18 fail-closed on empty AUTH_SECRET, timingSafeEqual :28,
        TTL :42); v1 routes getMobileUserId (jose.jwtVerify aud gm-mobile, fail-closed) → withTenant; instacart uses
        currentUserId()+withTenant. Secret scan (sk_live|AKIA|BEGIN PRIVATE|api_key=|password=) = 3 hits all doc
        comments / a runtime query-param interpolation of a configured key, zero committed secrets. Webhooks fail
        closed: Stripe constructEvent → 400 (route.ts:34-53); RevenueCat identical 401 for unset vs wrong secret
        (constant-time SHA-256, :48-53); Gmail timing-safe 403 (dev bypass gated on NODE_ENV!=production). Headers:
        next.config.mjs:29-44 CSP frame-ancestors none + X-Frame DENY + HSTS 1yr+subdomains + base-uri/form-action
        self. RLS deny-by-default (0002_rls.sql: app connects as non-owner grocery_app, NULLIF-empty→NULL→deny,
        per-table tenant_isolation USING+WITH CHECK, child tables via parent EXISTS). Public surfaces layered
        (parse-receipt rateLimit→captcha→503→bounded→checkDemoQuota; invite/redeem rateLimit→bounded→idempotent→
        generic non-enumerating error, grants only the distinct invite secret never master pw). A→A+ nit (unchanged):
        rateLimit + checkDemoQuota are in-memory per-process, so under horizontal scale the global demo-spend ceiling
        multiplies by instance count — bounded by per-IP + captcha + daily cap (degrades cost control, not an unauth'd
        surface); needs the Upstash-Redis backing tracked in PENDING_OPS.
    - name: design_taste
      grade: A
      ship_critical: true
      evidence: >-
        RISES B → A — the ship-gate-breaking gap is GENUINELY CLOSED (independently verified, not rubber-stamped).
        (1) apps/mobile/lib/icons.tsx is a real @expo/vector-icons/Ionicons registry (package.json @expo/vector-icons
        ^15.1.1), mirroring the web registry via a makeIcon(name,color) factory, with real design taste in its
        comments (Star=star and Wrapped=trophy-outline deliberately avoid the sparkle glyph the web registry reserves
        for "Planned by AI"). (2) Adversarial UTF-8 raw-glyph sweep over apps/mobile/app (arrows/chevrons/checks/stars
        U+2190/2192/2039/203A/25B8/25BE/2713/2714/2605/2606) = ZERO structural offenders; every hit is a trailing
        inline → in a CTA label ("See plans →" spend.tsx:92, "Continue →" onboarding.tsx:310) — a defensible
        typographic convention. (3) All previously-cited offenders now render real components: cook/[id].tsx:14,107,
        131,174,194,249 (ChevronLeft/ArrowLeft/ArrowRight/Check), recipes.tsx:124 (ChevronRight list chevron),
        upgrade.tsx:122,160 (Star #548 + Check), onboarding.tsx:257 (Check), index.tsx:86 (home cards map Icon
        components). (4) Residual web nit CLOSED: cook/[id]/page.tsx:14,182 imports+renders ChevronDown, no raw ▾.
        (5) No emoji-as-icon (the only web emoji is a navigator.share caption string in wrapped/page.tsx:33-37, not
        UI), no fake data. Web system stays bespoke + a11y-complete (globals.css 50-900 ink/brand ramps + dark
        override, :focus-visible ring :131, safe-area insets, prefers-reduced-motion :455). A→A+ nit: an A+ purist
        would route the ~9 trailing-→ CTA labels through the existing <ArrowRight/> for total consistency — polish,
        not a bug.
    - name: launch_readiness
      grade: A
      ship_critical: true
      evidence: >-
        Store assets real binaries at correct dims: apps/mobile/assets/icon.png + adaptive-icon.png are 1024×1024
        PNGs, docs/store/assets/feature-graphic.png is 1024×500 (Play spec). Billing wired both surfaces: billing/
        index.ts:209,221 export pure rcEventAction (grant/revoke/ignore) + tierFromRevenueCatProduct (family>annual>
        monthly), table-tested (index.test.ts, 14 refs); prices 499/3999/999/7999 (:43,59,69-70) exactly match the
        disclosure worksheet. apps/mobile/lib/purchases.ts real (Purchases.purchasePackage → hasPremiumEntitlement,
        restore(), degrade when SDK key absent). Webhooks fail closed (revenuecat 401 unset==wrong timing-safe; stripe
        requires both keys + sig-verify). Account deletion real both surfaces: queries.ts:1522 deleteUserAndAllData
        (ON DELETE CASCADE) wired at profile/page.tsx:79 (confirm==="delete") + api/mobile/account/route.ts (Bearer +
        confirm gate + 3/day rate-limit). Deploy config real: vercel.json crons (h14/h15) + git.deploymentEnabled
        false; app.config.ts env-driven versions/projectId with fallbacks; eas.json full production submit profile.
        A→A+ nit (unchanged): the only remaining incompleteness is owner-supplied — eas.json submit.production.ios
        OWNER_APPLE_ID / OWNER_APP_STORE_CONNECT_APP_ID / OWNER_APPLE_TEAM_ID placeholders + the owner-provided
        google-play-key.json. Legitimate human-in-the-loop credential gates, not code defects.
    - name: tests_evals
      grade: A
      ship_critical: false
      evidence: >-
        Coverage ENFORCED in a REQUIRED gate: packages/core/package.json:56 test = vitest run --coverage;
        vitest.config.ts:12-17 thresholds lines 70 / branches 84 / functions 76 / stmts 70 (vitest exits non-zero
        below floor); ci.yml:57 verify job runs pnpm -r run test → a coverage regression fails a required job. Actuals
        88.46 / 88.2 / 90.72 / 88.46 (1028 tests). Flagship vision eval NON-VACUOUS: scan.eval.test.ts:75 calls the
        REAL detectPantryItems (live Gemini, no mock) against committed genuine Wikimedia fridge photos, gating on a
        recall floor (passRate≥0.8, :94) AND a separate anti-hallucination precision floor over human-verified absent[]
        lists (:106,124). 6 *.eval.test.ts under src/llm/evals (+ a margin eval) run nightly (evals.yml:11-14 cron +
        dispatch via run-evals.sh RUN_EVALS=1) and open/refresh a regression issue on failure (:60-71). All 27 skips
        are honest env gates (RUN_EVALS / TEST_DATABASE_URL / APP_URL / ctx.skip on rate-limit) — no undeclared
        unconditional skip. A→A+ nit: the coverage ratchet is loose on 3 of 4 axes — lines/stmts carry ~18pt slack and
        functions ~15pt vs their floors (only branches, 84 vs 88.2, ratchets tight), so a regression could delete a
        large untested block and still pass; tighten lines/stmts/functions to ~5pt below current to close.
    - name: artifact_integrity
      grade: A
      ship_critical: false
      evidence: >-
        check-self-validation.mjs → exit 0 (8 capabilities, 8 active); --readiness → exit 0 (unmet [], unmet_unsurfaced
        []). Manifest verified HONEST, not gamed-green: 3 capabilities re-verified deep — billing/index.test.ts:131-187
        table-tests the real exported rcEventAction (7 grant / 2 revoke / 6 ignore) + tierFromRevenueCatProduct
        precedence + case-insensitivity; media-gen.test.ts:105-184 injects a fake MediaProvider into the REAL
        MediaGenClient asserting success mapping (image/video/audio) AND every degrade branch (no-key unavailable,
        audit-first rejected before key check, throw/empty/MEDIA_TIMEOUT_MS → error); staging.test.ts drives
        stageCreative over a 4-format brief (tally, metadata-only exclusion, continue-on-error). No active capability
        parked planned/retired to dodge the tripwire (all 8 active). The only e2e skip is email-roundtrip.spec.ts:46
        gated on the DECLARED EMAIL_CAPTURE_DIR. Docs consistent: pricing agrees to the cent across billing/index.ts,
        upgrade/page.tsx, BUSINESS_CASE.md; zero \bPro\b leak (tiers read Premium/Family everywhere). Ticked DoD boxes
        back to real artifacts (/discover /cookbook /invite /barcode /remix routes exist; Referrals backed by
        referral/rewards.ts wired via lib/referral.ts). A→A+ nit (unchanged): marketing-media-gen is fully built +
        4-file tested but has NO product-reachable caller (staging-only, Track-H gated) — a reachability nit honestly
        disclosed, over-coverage not gaming; caps at A not A+.
    - name: business_case
      grade: A
      ship_critical: false
      evidence: >-
        Independently RECOMPUTED all three scenarios to the dollar: conservative 500×0.35×0.025=4.375/mo ÷0.065 → 67.3
        ×$3.82×12 = $3,085 ≈ $3,100 ✓; base 1500×0.45×0.04=27/mo ÷0.037 → 729.7 ×$3.82×12 = $33,459 ≈ $33,450 ✓;
        optimistic 6000×0.55×0.06=198/mo ÷0.030 → 6600 ×$4.32×12 = $342,144 ≈ $342,000 ✓. ARPU 0.70×$4.24 +
        0.30×($33.99/12)=$3.818 ✓; blended base churn 0.28×(20%/12)+0.72×4.5%=3.707% ✓. floor_met_year1:false stated
        HONESTLY (base steady-state $33.45K < $100K floor, "❌ below the floor" repeated §4/§5/§8; literal year-1 ~$6-12K
        disclosed even lower); the doc's own stamp documents dropping a prior gamed ~$106K median to $33K. Prices
        code-sourced + match: billing/index.ts:43,59,69-70 ⇔ doc. Growth levers BUILT not stubs: referral/rewards.ts:36
        MAX_REWARD_MONTHS hard cap; growth/experiments/stats.ts two-proportion z-test (:46-73) + Wilson CI (:90-105) +
        power-based min-sample (:122-137), all null on insufficient data; cohort-retention.ts:70-129 one set-based CTE
        no N+1. A→A+ nit (unchanged): the machine-readable header field is STILL named arr_year1 while holding the
        steady-state run-rate ($33,450) — disclosed in the adjacent comment, a naming nit not hidden inflation. Rename
        to arr_steady_state to reach A+.
    - name: performance
      grade: B
      ship_critical: false
      evidence: >-
        Both standing gaps re-confirmed unchanged (held at B, 6th cycle, issue #320). (1) NO CI perf-budget gate: grep
        of .github/workflows/ for bundlesize|lighthouse|size-limit|budget|wc -c|maxSize = 3 hits all prose comments
        about the serverless REQUEST wall-clock budget (ci.yml:186, evals.yml:28, margin-eval.yml:40), zero bundle-byte
        assertion; ci.yml gates perf-adjacent only via the missing-export grep. (2) Edge middleware 280,299 bytes raw
        (ls -la apps/web/.next/server/middleware.js from this cycle's build) — BYTE-IDENTICAL to last cycle (report
        shows 88.6 kB gzip); root cause unchanged: middleware.ts:1 imports NextAuth, :6 instantiates auth, :130 broad
        matcher runs NextAuth/jose on nearly every path. No new perf work since 07-11 (icon systems, Margin telemetry,
        evals, docs, an auth race fix — none add a budget gate or trim the bundle). Good hygiene keeps it off C:
        stockLedger composite ledger_user_item_idx (schema.ts:466); meal_logs_user_cooked_at_idx (0020); trgm GIN +
        HNSW vector (0001); cohort-retention.ts:72-113 one set-based CTE no N+1; LLM cheap-first ladder. Non-ship-
        critical (≥B satisfies the gate). To reach A: add a real byte-assertion budget gate AND trim the edge bundle
        (jose-only edge auth or a narrower matcher).
  # Ordered: the sole below-A dim first (non-ship-critical, does not break the met gate), then bounded A→A+ polish on already-A dims.
  top_gaps:
    - dimension: performance
      ship_critical: false
      gap: >-
        (a) Add a CI perf-budget gate (size-limit / bundlesize / lighthouse-ci, or even a wc -c guard) enforcing
        middleware + per-page first-load ceilings so bundle regressions fail the build. (b) Trim the 280,299-byte edge
        middleware — move the next-auth/jose session read off the edge runtime (lightweight edge-safe JWT decode) or
        narrow the matcher (middleware.ts:1,6,130). Non-ship-critical (≥B satisfies the met gate; this is now the only
        below-A dimension). Tracked in issue #320 (open + accurate; byte figure unchanged — no creep this cycle).
    - dimension: design_taste
      ship_critical: true
      gap: >-
        A→A+ polish only (now at the ship bar, gate re-closed): ~9 mobile CTA labels still carry a trailing inline →
        ("See plans →", "Continue →") — a defensible typographic convention, but an A+ purist would route them through
        the already-registered <ArrowRight/> for total consistency. Not a bug. The B-level gap (no mobile icon system /
        raw structural glyphs) is CLOSED (#522 + #548); quality issue #520 closed this cycle.
    - dimension: launch_readiness
      ship_critical: true
      gap: >-
        A→A+ polish only (at the ship bar): the only remaining incompleteness is owner-supplied — eas.json submit
        placeholders (OWNER_APPLE_ID / ascAppId / appleTeamId) + the owner-provided google-play-key.json, and a few
        "owner decision required" data-safety flags. Legitimate human-in-the-loop gates, not code defects; do not block.
    - dimension: security
      ship_critical: true
      gap: >-
        A→A+ polish only (at the ship bar): rate-limit + demo LLM-spend ceiling are in-memory per Node process
        (rate-limit.ts, demo-quota.ts), so under Vercel horizontal scale the "global" cap becomes 500×instances.
        Bounded (captcha + per-IP layered on top) + documented; needs the Upstash-Redis backing already in PENDING_OPS
        before the single-absolute-cap claim holds at scale.
```

## Notes for the factory loop (consume, don't self-grade)

- **Ship gate is MET this cycle (overall B → A).** The ship-critical `design_taste` dimension is back
  to **A** — the factory genuinely closed the gap that broke the gate on 07-11. **#522** added an
  Ionicons icon system to `apps/mobile` (`apps/mobile/lib/icons.tsx`, a real `@expo/vector-icons`
  registry mirroring the web PWA) and replaced the raw-glyph nav/list/check chrome; **#548** removed the
  last raw glyph (`★` → `Star` icon) on the paywall. An adversarial UTF-8 raw-glyph sweep of
  `apps/mobile/app` now returns **zero** structural offenders, and the residual web `▾` nit is also
  closed (`cook/[id]/page.tsx:182` → `<ChevronDown>`). Verified independently, not rubber-stamped.
- **Everything else held.** `functional_reality` **A+** (zero fake data, ledger-only cook loop,
  outcome-asserting e2e, throw-safe auth); `correctness_reliability`, `security`, `launch_readiness`
  (all ship-critical) **A**; `tests_evals`, `artifact_integrity`, `business_case` **A**. 1028 core
  tests pass (up from 977); the self-validation manifest re-verified HONEST (8 capabilities genuinely
  exercised).
- **`performance` (B) is the only below-A dimension** and is unchanged (issue #320, 6th cycle): still no
  CI perf-budget gate; the raw edge bundle is **byte-identical** at 280,299 (no creep, no trim).
  Non-ship-critical — it does not affect the met gate. Closing it (a real byte-assertion budget gate +
  an edge-middleware trim) is the last step to overall **A+**.
- **The remaining A→A+ items are bounded polish** on already-A dims (mobile trailing-→ CTA labels →
  `<ArrowRight/>`; coverage-ratchet tightening; `arr_year1` → `arr_steady_state` rename; the
  in-memory-quota Redis backing). None block the gate; do not gold-plate.
