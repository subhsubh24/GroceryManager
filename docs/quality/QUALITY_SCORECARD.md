# GroceryManager — Quality Scorecard

> **Independent grade** assigned by the separate Quality Auditor routine (maker ≠ checker). The
> factory loop CONSUMES this as a DATA signal and never authors/overwrites it. Every grade below is
> backed by a mechanical signal the grader actually ran this cycle, plus file/line evidence. Grades
> may not exceed what the signals support. See `QUALITY_RUBRIC.md` for the scale and dimensions.

**As of 2026-07-09.** Overall: **A**. Ship gate: **MET** — every ship-critical dimension
(`functional_reality`, `correctness_reliability`, `security`, `design_taste`, `launch_readiness`) is
at **A**, and every other dimension is **≥ B**. **No dimension moved from last cycle (2026-07-05):**
8 of 9 dimensions remain at **A**; the sole below-A dimension is still `performance` (**B**,
non-ship-critical), unchanged from #320. Overall is held at **A** (not A+) by that one B. The 39
commits since the last grade were the §34 pre-launch funnel (public no-account demo #471 + gated-beta
invite codes #475), hardening (pantry-mutation degrade #480, ask/scan/add-receipt quota-gate degrade
#464/#465/#482), a11y (#466/#473), a partial design fix (#479), and docs — verified as genuine
improvements, **none a regression**, none closing the performance gap. The two NEW attacker-reachable
public surfaces (`/api/public/parse-receipt` demo, `/api/invite/redeem`) were audited hard and are
layered (rate-limit + captcha + spend-ceiling + generic non-enumerating errors); the two new
self-validation manifest capabilities were verified HONEST (their declared tests genuinely exercise
the capability).

```yaml
QUALITY_SCORECARD:
  as_of: 2026-07-09
  overall: A
  ship_gate_met: true
  graded_by: independent-quality-auditor   # maker != checker; one fresh adversarial subagent per dimension
  mechanical_signals:
    typecheck: pass                          # pnpm -r run typecheck → exit 0 (all packages Done)
    core_tests: pass                         # pnpm --filter @gm/core test → exit 0; 96 files pass / 10 skipped; 912 tests pass / 26 skipped (up from 871); coverage lines 87.19 / branches 87.79 / functions 90.88 (thresholds 70/84/76/70 met)
    prod_build: pass                         # NODE_ENV=production next build → exit 0; no missing-export warnings; 102 kB shared first-load; middleware reported 88.6 kB (gzip of a 280,299-byte raw edge bundle — up slightly from 279,931 last cycle, a mild ungated creep)
  dimensions:
    - name: functional_reality
      grade: A
      ship_critical: true
      evidence: >-
        Every journey traces to real server actions + DB writes, no dead-ends/fake data. signup/page.tsx:44-82
        rate-limits + captcha → createUserWithPassword(getAdminDb()) → signIn(credentials, redirectTo:/onboarding),
        no verify wall (matches journeys.spec.ts:34-38). Cook loop real: cook-actions.ts:39-58 runs logCook in
        withTenant → recipe/log-cook.ts:177 appendLedgerAndReproject per ingredient delta (never touches pantry_stock).
        NEW §34 demo funnel genuine + no-fake-data: demo-client.tsx:98-118 renders ONLY server-returned items (pasted
        SAMPLE_RECEIPT is user input, not fabricated output); api/public/parse-receipt/route.ts:55-158 = one real Gemini
        extract behind rate-limit(61)+captcha(99)+spend-ceiling(130)+503-degrade(105). NEW §34 invite funnel:
        api/invite/redeem/route.ts:66-104 → redeemWaitlistInvite (growth.ts:420-437, idempotent COALESCE) grants the
        SITE_GATE_INVITE_SECRET cookie (never master pw), middleware.ts:48 unlocks only /signup; client advances only on
        server ok:true (join-client.tsx:67-75). e2e outcome-asserts (journeys.spec.ts:57-59 getting-started not error
        boundary, :102-135 onboarding steps, :149 paywall $price, :166-170 protected-route bounce). A→A+ nit: the §34
        happy-path SUCCESS outcome (real parsed pantry rendered; code→cookie→/signup reached) is keyless-CI-unprovable
        (needs a Gemini key) — covered only by unit tests + the degrade/reject e2e branches.
    - name: correctness_reliability
      grade: A
      ship_critical: true
      evidence: >-
        Ledger-only invariant HOLDS: the sole production pantry_stock write is the upsert at persist.ts:128-134 inside
        reprojectStock; every other mutator routes through appendLedgerAndReproject (vision/persist.ts:102,156;
        waste-persist.ts:37; log-cook.ts:177), all other refs are SELECTs. Depletion edges guarded: <2 purchases→null +
        days<=0 skipped (depletion.ts:80,87); zero-delta confirmations excluded from reference point + acquisition date
        (:114-118, persist.ts:83-92); freshness re-grounds to later(purchase,confirm) (:124-131); grace window + max(0)
        clamp (:137-138). LLM degrades: generateWithVerify try/catch→escalate→VerificationExhaustedError circuit-break
        (client.ts:288-296), 8s withTimeout fail-fast (:150-170), nutrition double-wraps→EMPTY_MACROS (estimate.ts:117,
        135-138), receipt parse isolated per-message (gmail-sync.ts:250-256). NEW hardening (#480/#465/#464) genuine and
        does NOT swallow Next redirect() — the catches wrap only DB reads/mutations, revalidatePath stays outside, no
        redirect() inside any try. Ran depletion+persist targeted: 42 pass / 2 skip. A→A+ nit: #482's per-step ask-quota
        settlement runs only on the return path — if the agentic loop THROWS mid-run, the extra Gemini calls already made
        are never charged (up to ~7x G7 spend under-count on the throw path); bounded, non-blocking.
    - name: security
      grade: A
      ship_critical: true
      evidence: >-
        All api routes audited, ZERO unauth'd per-user data surface. NEW public surfaces graded hard and layered:
        /api/public/parse-receipt = per-IP rateLimit(3/60s, route.ts:61) + captcha verifyTurnstile(:99) + bounded input
        (8k/2MB/image mime :74-119) + checkDemoQuota(ip) reserved after validation (:130) + keyless 503 degrade (:105),
        single cheap-tier maxAttempts:1, non-POST→405; checkDemoQuota dual ceiling per-IP daily + global daily, denies
        WITHOUT incrementing, UTC rollover (demo-quota.ts:88-109). /api/invite/redeem = per-IP rateLimit(5/60s) + 64-char
        bound + keyless normalizeAndValidate before DB + idempotent COALESCE redeem + generic non-enumerating errors,
        grants ONLY the distinct SITE_GATE_INVITE_SECRET cookie (never master pw) that opens only /signup — no full-app
        bypass (route.ts:52-108). All 20 mobile/v1 routes verifyMobileToken (HMAC timing-safe, fail-closed on empty
        AUTH_SECRET, _lib.ts:23) or jose aud gm-mobile + withTenant; the two withTenant=0 are correct (account DELETE
        admin-cascade to verified userId; recipes/[id] global catalog). Webhooks fail closed (Stripe constructEvent,
        RevenueCat SHA-256 timing-safe 401, Gmail timing-safe). Cron + growth routes fail-closed CRON_SECRET/ADMIN_EMAIL.
        RLS deny-by-default non-owner grocery_app, NULLIF-empty→NULL→deny (0002_rls.sql:31-70). CSP+HSTS+X-Frame:DENY, no
        wildcard/credentialed CORS (next.config.mjs:20-44). A→A+ nit: rate-limit + demo spend ceiling are in-memory
        per-Node-process (rate-limit.ts:12, demo-quota.ts:56) — under Vercel horizontal scale the "global" cap becomes
        500×instances, so an IP-rotating botnet across warm lambdas can exceed the intended absolute LLM-spend bound;
        documented, captcha+per-IP layered on top, needs the Redis backing already tracked in PENDING_OPS.
    - name: design_taste
      grade: A
      ship_critical: true
      evidence: >-
        Bespoke hand-tuned token system, not Tailwind defaults: globals.css:5-99 variable-backed ink/brand RGB ramps that
        INVERT ink in .dark (900=lightest) with a fixed --brand-solid carrying explicit WCAG-AA reasoning
        (cook-mode.tsx:170-172 documents choosing brand-solid-hover BECAUSE brand-solid fails 4.5:1 as text). Real a11y
        infra: one global :focus-visible ring (:131), forced 16px iOS inputs (:445-451), prefers-reduced-motion (:455-463),
        44/48px tap targets, safe-area insets (:153,388). NEW /demo + /join are A+-quality: registry icons throughout,
        role=tablist/aria-selected (demo-client.tsx:124-144), sr-only labels, role=alert (:212), honest server-only result
        states; join-client.tsx aria-invalid/aria-describedby (:107-108), autoComplete=one-time-code, advances only on
        server {ok:true}. No fake data. A→A+ nit (partially-fixed carry): commit #479 swapped the cook-mode ✓ Done CTA to
        the <Check> icon (cook-mode.tsx:114,182) but LEFT raw glyph UI chrome on the same file's two primary
        step-navigation buttons — "← Back" (:168) and "Next →" (:191) — even though <ArrowLeft>/<ArrowRight> are in the
        registry (icons.tsx:50-51) and used correctly on /demo + /join. So "no raw glyph UI chrome remains" is still false.
    - name: launch_readiness
      grade: A
      ship_critical: true
      evidence: >-
        Mobile IAP real, not a stub: purchases.ts:103-113 Purchases.purchasePackage→hasPremiumEntitlement, restore()
        (:116-125), logIn(userId) (:47-64), degrades via isPurchasesConfigured() (:37-39); upgrade.tsx wires annual/
        monthly buy + restore, inert "Payments coming soon" only when unconfigured (:212-222). RevenueCat webhook fails
        closed (401 timing-safe when REVENUECAT_WEBHOOK_AUTH unset, route.ts:64-69) + writes the SAME appendPreferenceSignal
        entitlement/tier ledger as Stripe (:92-118, trial-ineligibility on GRANT). Account deletion real both surfaces
        (queries.ts:1522 deleteUserAndAllData + ON DELETE CASCADE across ~25 FKs; profile/page.tsx:79 web;
        api/mobile/account/route.ts:42 Bearer+confirm+rate-limit). Store assets real PNGs (icon-1024 1024², feature-graphic
        1024×500), privacy/terms 154/155 lines, /support→/help alias. eas.json production profile + app.config.ts env-driven
        versions, vercel.json crons. A→A+ nit (carried, uncorrected 3rd cycle): the RevenueCat event→tier map
        (tierFromProduct/GRANT_EVENTS/REVOKE_EVENTS, revenuecat/route.ts:32-49) is still inline + unexported with ZERO unit
        test and no capabilities.json entry — a product-substring typo or event-set error would misgrant/misrevoke device
        entitlements with nothing in CI to catch it. Extract to @gm/core/billing + add a table test.
    - name: tests_evals
      grade: A
      ship_critical: false
      evidence: >-
        Coverage IS enforced in required CI: package.json test = vitest run --coverage; thresholds vitest.config.ts:12-17
        (lines 70/branches 84/functions 76/stmts 70); CI verify job runs it (ci.yml:57) so a floor breach fails a REQUIRED
        job; met at 87.19/87.79/90.88. Flagship vision eval REAL not vacuous: scan.eval.test.ts:44-61 uses genuine
        CC-licensed JPEG fridge photos, calls live detectPantryItems with a recall floor (:94 passRate≥0.8) AND a distinct
        anti-hallucination precision floor over curated absent[] items (:97-125). All 6 *.eval.test.ts gate on a real 0.8/0.7
        floor, wired to the nightly RUN_EVALS cron (evals.yml:56-71) that opens a regression issue on failure. Skips are all
        honest env gates (!RUN_EVALS/!DB/!CAPTURE_DIR); evaluate.mjs:94-101 machine-flags any undeclared env-gated test.skip.
        NEW §34 tests are real behavioral tests: demo-quota.test.ts:44-70 proves the global wallet-drain ceiling across
        rotating IPs + no-phantom-increment + UTC reset; invite-code.test.ts:81-101 maps each 5-bit value to its alphabet
        symbol via injected byte source + all-zero-bias case. A→A+ nit: line/stmt (70 vs ~87) + function (76 vs 90.88) floors
        carry ~15-17pt slack; only the branch floor (84 vs 87.79, ~4pt) ratchets tight, so a regression could delete a
        substantial untested block and still pass the gate.
    - name: artifact_integrity
      grade: A
      ship_critical: false
      evidence: >-
        check-self-validation.mjs → exit 0 (7 capabilities, 7 active); --readiness → exit 0 (unmet [], unmet_unsurfaced []).
        Verified HONEST, not gamed-green: the two NEW manifest entries genuinely exercise their capability —
        public-demo-spend-ceiling's demo-quota.test.ts:44-70 really drives checkDemoQuota (route calls it at
        parse-receipt/route.ts:130 before spending), invite-code-redeem's invite-code.test.ts:81-101 drives real
        generation/masking and redeemWaitlistInvite is genuinely idempotent (growth.ts:426-429 COALESCE). e2e assertions are
        real outcomes not page-loads (journeys.spec.ts:198 demo status∈[200,429,502,503]+generic error+JSON type; :243-263
        made-up invite→404/400 non-enumerating, malformed→400, GET→405); CI runs it (ci.yml:215). Only e2e skip is
        email-roundtrip.spec.ts:46 gated on EMAIL_CAPTURE_DIR which IS declared (capabilities.json:28) — the env-gated-skip
        trap is satisfied. Docs consistent: pricing agrees across billing/index.ts (499/3999/999/7999), upgrade/page.tsx
        ($4.99/39.99/9.99/79.99), BUSINESS_CASE.md:44-46. No capability parked planned/retired to dodge the tripwire. A→A+
        nit: in keyless CI (dummy key) the demo e2e lands on the 502 catch branch (parse-receipt/route.ts:153), so the
        checkDemoQuota reserve path is proven only by unit test, never end-to-end — honestly DISCLOSED in the manifest note,
        so disclosed-not-gamed.
    - name: business_case
      grade: A
      ship_critical: false
      evidence: >-
        Honest: floor_met_year1 false (BUSINESS_CASE.md:13); §4B/§5/§8 all restate the base steady-state ≈$33.45K < $100K
        floor, no fudging. Independently recomputed all three scenarios to the dollar: conservative 500×0.35×0.025=4.375/mo
        ÷0.065 → 67 ×$3.82×12 = $3.1K ✓; base 1500×0.45×0.04=27 ÷0.037 → 730 ×$3.82×12 = $33.46K ✓; optimistic
        6000×0.55×0.06=198 ÷0.030 → 6600 ×$4.32×12 = $342K ✓; blended churn 3.71% ✓; floor threshold ~2,181/4,485 dl/mo ✓.
        Conversion transparently within cited band: 4% base labeled freemium upper-mid (OpenView 2023 + Amplitude 2024, 2-5%),
        with a stamp that self-CORRECTS the prior gamed 12.6% trial-rate down to the freemium rate. Prices code-sourced
        (billing/index.ts:40,56,66-67 = doc §1 exactly). Growth levers BUILT (real code, not stubs): referral ladder
        (rewards.ts:29-89 capped MAX_REWARD_MONTHS), A/B stats (stats.ts:46-73 two-proportion z-test + :90-105 Wilson CI),
        cohort retention (cohort-retention.ts), UTM (growth.ts:17-21). #481 claim TRUE: H14/H15 lifecycle emails real
        (lifecycle/emails.ts:13,84,114 + api/cron/h14-annual-nudge + h15-winback, cron-gated, dormant until email provider
        connected — honestly stated). A→A+ nit: the machine-readable arr_year1 header field holds the STEADY-STATE run-rate
        ($33.45K) while the doc body puts literal first-12-month base revenue at ≈$6.5K — a ~5x semantic mismatch for a field
        literally named arr_year1 (disclosed in the adjacent comment, so a naming nit not dishonesty). Rename to
        arr_steady_state.
    - name: performance
      grade: B
      ship_critical: false
      evidence: >-
        Good hygiene keeps it off C: hot paths indexed (stockLedger composite ledger_user_item_idx(userId,canonicalItemId)
        schema.ts:466 covers reprojectStock; 0020 meal_logs(user_id,cooked_at); 0001 trgm GIN + HNSW vector_cosine_ops);
        getCohortRetention (cohort-retention.ts:73-113) is one set-based CTE, no N+1; LLM cheap-first ladder; client bundles
        reasonable (102 kB shared). Recent perf commits are real latency wins but miss BOTH gaps: #457 Promise.all-parallelizes
        independent tenant reads on list/plan/recipes hot pages, #467 parallelizes the 7 ask-brief reads pre-LLM — neither adds
        a CI budget nor slims the edge bundle. GAPS (hold it at B, unchanged from #320, both re-confirmed this cycle): (1) NO CI
        perf-budget gate — grep of .github/workflows/*.yml for bundlesize|lighthouse|size-limit|budget = only two prose
        comments (ci.yml:186, evals.yml:28), zero assertion that fails the build on a bundle/middleware regression; (2) edge
        middleware 280,299 bytes raw (middleware.ts:1,6 imports NextAuth→jose onto the edge runtime, broad matcher :130 runs on
        nearly every non-static request) — the reported 88.6 kB is only the gzip figure. This cycle the raw bundle CREPT UP
        279,931→280,299 bytes, exactly the silent regression an absent budget lets through. It is the only thing off overall-A+.
  # Ordered: the sole below-A dimension first (the only thing off overall-A+), then bounded A→A+ polish on already-A ship-critical dims.
  top_gaps:
    - dimension: performance
      ship_critical: false
      gap: >-
        (a) Add a CI perf-budget gate (size-limit / bundlesize / lighthouse-ci, or even a wc -c guard) enforcing middleware
        and per-page first-load ceilings so bundle regressions fail the build — this cycle the raw edge bundle silently crept
        279,931→280,299 bytes, exactly what an absent budget lets through. (b) Trim the 280,299-byte edge middleware — move the
        next-auth/jose session read off the edge runtime (lightweight edge-safe JWT decode) or narrow the matcher
        (middleware.ts:1,6,130). This is the ONLY dimension below A and the only thing holding overall off A+; non-ship-critical,
        does not block the (met) ship gate. Tracked in issue #320 (still open + accurate; byte figure refreshed).
    - dimension: launch_readiness
      ship_critical: true
      gap: >-
        A→A+ polish only (already at the ship bar): the RevenueCat event→tier mapping (tierFromProduct / GRANT_EVENTS /
        REVOKE_EVENTS, webhooks/revenuecat/route.ts:32-49) is STILL inline + unexported with NO unit test and no
        capabilities.json entry — a product-substring typo or grant/revoke reclassification could misgrant/misrevoke device
        entitlements un-caught. Extract to an exported pure fn in @gm/core/billing + add a table test + register it. Unchanged
        across three cycles; not blocking.
    - dimension: design_taste
      ship_critical: true
      gap: >-
        A→A+ polish only (already at the ship bar): commit #479 fixed only the cook-mode ✓ Done CTA (→ <Check>) but LEFT raw
        Unicode arrow glyphs as UI chrome on the SAME file's two primary step-navigation buttons — "← Back"
        (cook/[id]/cook-mode.tsx:168) and "Next →" (:191) — despite <ArrowLeft>/<ArrowRight> being in the registry and used
        correctly on /demo + /join. Swap both to registry icons to close the flagged nit for real. Trivial, non-blocking.
    - dimension: security
      ship_critical: true
      gap: >-
        A→A+ polish only (already at the ship bar): the rate limiter and demo LLM-spend ceiling are in-memory per Node process
        (rate-limit.ts:12, demo-quota.ts:56), so under Vercel horizontal scale the "global" 500/day wallet-drain cap becomes
        500×instances and per-IP caps are per-instance — an IP-rotating botnet across warm lambdas can exceed the intended
        absolute LLM-spend bound. Documented + captcha/per-IP layered on top (bounded), but a shared store (Upstash Redis,
        already in PENDING_OPS as llm-quota-redis-upgrade) is needed before the "single absolute cap" claim holds at scale.
```

## Notes for the factory loop (consume, don't self-grade)

- **Ship gate remains MET; grade unchanged from 2026-07-05 — 8 of 9 dimensions at A.** No
  ship-critical regression across the 39 intervening commits (§34 funnel + hardening + a11y + docs,
  all verified genuine). The two NEW public attack surfaces were graded hard and are layered; the two
  NEW self-validation manifest capabilities were verified HONEST (declared tests genuinely exercise
  the capability, not stubs).
- **`performance` (B) is STILL the ONLY thing between the product and overall A+.** Non-ship-critical
  (≥ B satisfies the gate) but the single highest-leverage improvement. Two concrete asks unchanged
  since baseline: a CI perf-budget gate + a real edge-middleware trim. Issue #320 tracks it (open,
  accurate). **The raw edge bundle crept 279,931 → 280,299 bytes this cycle** — a small ungated
  regression that a perf budget would have failed. Do not read the 88.6 kB figure as a reduction; it
  is the Next 15.5 gzip report.
- Three bounded A→A+ polish items on already-A ship-critical dims are listed (RevenueCat event-map
  unit test — 3rd cycle uncorrected; the cook-mode arrow glyphs — #479 fixed only the ✓, not the
  arrows; the in-memory demo/rate-limit ceiling needing Redis before it holds at horizontal scale).
  Optional gold-avoidance — build only if cheap.
