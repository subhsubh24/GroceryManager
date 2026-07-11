# GroceryManager — Quality Scorecard

> **Independent grade** assigned by the separate Quality Auditor routine (maker ≠ checker). The
> factory loop CONSUMES this as a DATA signal and never authors/overwrites it. Every grade below is
> backed by a mechanical signal the grader actually ran this cycle, plus file/line evidence. Grades
> may not exceed what the signals support. See `QUALITY_RUBRIC.md` for the scale and dimensions.

**As of 2026-07-11.** Overall: **B**. Ship gate: **NOT MET** — the ship-critical dimension
`design_taste` is graded **B** this cycle, so the gate (which requires A/A+ on all five ship-critical
dims) is not met. **This is a RE-ASSESSMENT, not a code regression.** A more thorough design grader
surfaced a **long-standing** gap prior cycles under-weighted: the native Expo app (`apps/mobile`, in
active App Store / Play submission scope per `eas.json`) has **no icon system at all** — ~110 raw
Unicode-glyph affordances (`← Back`, `Next →`, `›` list chevrons, `✓` checks) stand in for icons,
while the web PWA has a full hand-built registry. The code did not get worse (only #512 a11y labels +
#495 tier label touched mobile since 07-09, neither adding/removing glyphs); the grading got more
complete. **Everything else improved or held:** `functional_reality` rose **A → A+**, and three
previously-flagged A→A+ nits were genuinely CLOSED this cycle — the 3-cycle RevenueCat event-map was
extracted + table-tested (#487), the cook-mode arrow glyphs were swapped to registry icons (#486), and
the #504 ask-quota throw-path under-count was fixed + regression-tested. The new §11 media-gen adapter
(#509/#515) was audited HONEST (its declared tests genuinely exercise it via injected fake providers).
`performance` stays **B** unchanged (no CI perf-budget gate; edge middleware byte-identical at 280,299).

```yaml
QUALITY_SCORECARD:
  as_of: 2026-07-11
  overall: B
  ship_gate_met: false          # design_taste (ship-critical) is B this cycle — see notes; re-assessment of a long-standing mobile-iconography gap, not a fresh code regression
  graded_by: independent-quality-auditor   # maker != checker; one fresh adversarial subagent per dimension
  mechanical_signals:
    typecheck: pass                          # pnpm -r run typecheck → exit 0 (all packages Done)
    core_tests: pass                         # pnpm --filter @gm/core test → exit 0; 99 files pass / 10 skipped; 977 tests pass / 26 skipped (up from 912); coverage lines 87.73 / branches 87.83 / functions 91.21 (thresholds 70/84/76/70 met)
    prod_build: pass                         # NODE_ENV=production next build → exit 0; no missing-export warnings; 102 kB shared first-load; middleware reported 88.6 kB (gzip of a 280,299-byte raw edge bundle — BYTE-IDENTICAL to last cycle: no creep, no trim)
    self_validation: pass                    # node scripts/check-self-validation.mjs → exit 0 (8 capabilities, 8 active, all keyless-validated); --readiness → exit 0 (unmet [], unmet_unsurfaced [])
  dimensions:
    - name: functional_reality
      grade: A+
      ship_critical: true
      evidence: >-
        Every journey traces to real server actions + DB writes; a fake-data grep over apps/web/app/**/*.tsx
        (lorem/mock/dummy/hardcoded price/Math.random-name) returned ZERO fabricated-data hits (only a "no fake
        data" comment at page.tsx:64). signup/page.tsx:80 signs in with redirectTo:/onboarding, no verify wall
        (journeys.spec.ts:22,36 assert the absence of a verify dead-end). Cook loop real: cook/[id]/page.tsx:89
        logThisCook → log-cook.ts:177 appendLedgerAndReproject (never touches pantry_stock; persist.ts:51 enforces
        the ledger-only invariant). §34 public demo renders ONLY server-returned items (demo-client.tsx:111
        setItems(data.items) gated on res.ok && data.items; SAMPLE_RECEIPT:33 is labeled synthetic INPUT), degrades
        to calm 503/502/429 JSON never a fake success (parse-receipt/route.ts:100-107,153-158). NEW #517 throw-safe
        auth: tenant.ts:13,31 catch auth() throwing (stale cookie / AUTH_SECRET rotation) → degrade to signed-out,
        and loadHomeData wraps everything → EMPTY_HOME_DATA (page.tsx:127) so the dashboard can never fall to the
        "Couldn't load" error boundary. e2e assertions are real OUTCOMES not page loads (journeys.spec.ts:57-59
        error-boundary-absent + Sign-out/Getting-started present, :102-135 steps through onboarding to dashboard,
        :149 real $ paywall price, :243-248 non-enumerating invite reject). Rose A→A+: zero findings, journeys work
        end-to-end with honest empty/error states and defense-in-depth beyond the bar.
    - name: correctness_reliability
      grade: A
      ship_critical: true
      evidence: >-
        Targeted run pantry+depletion+persist+spend+media = 116 pass / 2 skip. Ledger-only invariant HOLDS: the sole
        production pantry_stock write is the upsert at persist.ts:128-134 inside reprojectStock (grep confirms no
        db.update(pantryStock) in production); every mutator routes through appendLedgerAndReproject (vision/persist.ts:
        102,156; waste-persist.ts:37; log-cook.ts:177). Depletion edges guarded: <2 purchases→null (:80), days<=0 skip
        (:87), zero-delta exclusion via nonZeroEvents (:114), grace window (:134), max(0) clamp (:137). LLM degrades:
        generateWithVerify escalate ladder + maxAttempts circuit-break (client.ts:269,292), 8s withTimeout (:150-153),
        nutrition double-wrap → EMPTY_MACROS (estimate.ts:137). #504 FIXED (prior ~7x under-count gone):
        ChatToolLoopError.stepsAttempted (client.ts:515) → charges max(1,stepsAttempted) → ask/actions.ts:77-79 settles
        the REAL call count; regression test client.test.ts:210-227 asserts a later-round failure charges BOTH calls.
        Media #509/#515 audit-first + degrade + never-throw (media-gen.ts:137-142 preflight before any paid call;
        no-key → unavailable; every generate* try/catch → {status:error}); redirect() invariants stay OUTSIDE try.
        A→A+ nit: media-gen re-audits the REQUEST (pure, same input) when embedding the ok payload (media-gen.ts:168,
        208,257) so the "post-generation" audit can never catch anything the preflight didn't — a cosmetic altitude
        smell with zero correctness impact (the load-bearing gate is the correct preflight).
    - name: security
      grade: A
      ship_critical: true
      evidence: >-
        All 41 api route.ts files audited individually; ZERO unauth'd per-user data surface. Secret scan (git grep
        sk_live|AKIA|BEGIN PRIVATE|api_key=) = clean (3 hits all doc/comment format-strings); only NEXT_PUBLIC secret
        is the Turnstile SITE key (public by design). 18 mobile routes verifyMobileToken (HMAC-SHA256, fail-closed on
        empty AUTH_SECRET, timing-safe) → withTenant; v1 routes jwtVerify aud gm-mobile fail-closed. Public surfaces
        layered: parse-receipt = per-IP rateLimit → captcha → 503 keyless-degrade → bounded 2MB/8k → checkDemoQuota
        dual per-IP/global ceiling reserved late → cheap-tier single extract (route.ts:59,95,100,149). invite/redeem =
        rateLimit → 64-char bound → normalizeAndValidate before DB → idempotent redeem → grants ONLY the distinct
        SITE_GATE_INVITE_SECRET cookie (never master pw), generic non-enumerating errors. Webhooks fail closed (Stripe
        constructEvent 400; RevenueCat SHA-256 timingSafeEqual 401 same for unset/wrong; Gmail timing-safe). Cron (5)
        + growth admin routes fail-closed CRON_SECRET/ADMIN_EMAIL. RLS deny-by-default (0002_rls.sql: NULLIF-empty→NULL
        →deny), app connects as non-owner grocery_app. CSP frame-ancestors none + HSTS + X-Frame DENY, no wildcard
        credentialed CORS (next.config.mjs). Media #509 is server-side lib code, no new route/surface. A→A+ nit:
        rate-limit + demo-quota are in-memory per Node process (rate-limit.ts, demo-quota.ts:54-55), so under Vercel
        horizontal scale the "global" 500/day cap becomes 500×instances — bounded (captcha + per-IP still defend) and
        documented; needs the Upstash-Redis backing tracked in PENDING_OPS before the absolute-cap claim holds at scale.
    - name: design_taste
      grade: B
      ship_critical: true
      evidence: >-
        The web PWA design system is genuinely A/A+ hand-crafted work; the NATIVE app is not, which caps the DIMENSION
        (both surfaces are in ship scope) at B — a real, named, non-blocking gap, not a trivial nit. VERIFIED FACTS:
        apps/mobile has NO icon library (package.json has zero lucide/@expo/vector-icons/react-native-svg; no local
        SVG/icon components — only app-icon PNGs), and ~110 raw-glyph affordances stand in for icons across the native
        surface: cook/[id].tsx:101,119,160,174 (← Back / ← Recipes / ← Prev / Next →), index.tsx:43-91 (12 card labels),
        recipes.tsx:117 (› list-row chevron), cook/[id].tsx:229 & onboarding.tsx:256 & upgrade.tsx:158 (✓ checks). The
        app is in ACTIVE store-submission scope (eas.json submit block, iOS + Android) so this is a shippable-surface
        gap, and an experienced product designer targeting the App Store would use SF Symbols / vector icons, not literal
        ✓/›. Residual web nit: cook/[id]/page.tsx:182 still renders a raw ▾ caret while ChevronDown was registered for
        exactly this ("disclosure indicator", icons.tsx:53) and sits unused. GOOD (why the web surface is A+ and the
        dimension isn't below B): globals.css:13-88 bespoke ink/brand RGB ramps that invert in .dark with explicit
        WCAG-AA reasoning, :focus-visible ring (:131), 16px/48px iOS inputs, safe-area insets, reduced-motion; the #486
        cook-mode arrow-glyph fix is REAL (ArrowLeft/ArrowRight/Check registry icons, cook-mode.tsx:5,168,192); /demo +
        /join are A+ (role=tablist/aria-selected, sr-only labels, role=alert). No emoji-as-UI anywhere (sweep = 0), no
        fake data. NOTE: this is a re-assessment of a long-standing condition (mobile glyphs predate this cycle), not a
        fresh regression. To reach A: give apps/mobile an icon system and replace the ←/→/›/✓ chrome (+ swap the web ▾).
    - name: launch_readiness
      grade: A
      ship_critical: true
      evidence: >-
        The 3-cycle RevenueCat A→A+ nit is genuinely CLOSED (#487): billing/index.ts:209 rcEventAction + :221
        tierFromRevenueCatProduct are now EXPORTED pure fns with RC_GRANT/RC_REVOKE_EVENTS (most-specific-first), the
        webhook route IMPORTS them (revenuecat/route.ts:26), and index.test.ts:131-188 is a real table test catching the
        exact failure modes (CANCELLATION/BILLING_ISSUE → ignore not revoke; premium_family_annual → premium_family
        substring precedence; case-insensitivity; null defaults) — 44 billing tests pass. capabilities.json
        billing-entitlements covers it keyless. Mobile IAP real: purchases.ts:103 Purchases.purchasePackage →
        hasPremiumEntitlement, :116 restore(), :56 logIn(userId), :37 isPurchasesConfigured() degrade; upgrade.tsx:177
        real buy/restore, :213 inert "coming soon" only when unconfigured. RevenueCat webhook fails closed (401 timing-
        safe, same appendPreferenceSignal ledger as Stripe). Account deletion real both surfaces (queries.ts:1522
        deleteUserAndAllData + ON DELETE CASCADE across ~25 FKs; profile/page.tsx:79 web; api/mobile/account/route.ts:29
        Bearer+confirm+rate-limit). Store assets real PNGs (icon-1024 1024², feature-graphic 1024×500 exact Play spec),
        privacy-disclosures.md:74 discloses IAP pricing that MATCHES code, /support→/help. eas.json production profile,
        app.config.ts env-driven versions, vercel.json 2 crons. A→A+ nit: only remaining incompleteness is owner-supplied
        (eas.json OWNER_APPLE_ID/ascAppId placeholders; a few "owner decision required" data-safety classification flags)
        — legitimate human-in-the-loop gates, not code defects; no promised-but-absent artifact.
    - name: tests_evals
      grade: A
      ship_critical: false
      evidence: >-
        Coverage ENFORCED in required CI: package.json:54 test = vitest run --coverage; thresholds vitest.config.ts
        (lines 70/branches 84/functions 76/stmts 70); ci.yml:57 verify job runs pnpm -r run test so a floor breach fails
        a REQUIRED job; met at 87.73/87.83/91.21 (977 tests). Flagship vision eval REAL: scan.eval.test.ts:94,124 gates on
        BOTH a recall floor (passRate≥0.8) AND a separate anti-hallucination precision floor over human-verified absent[]
        lists, against genuine Wikimedia fridge photos, calling live detectPantryItems (not stubbed). All 6 *.eval.test.ts
        run nightly (evals.yml:12,60-71) against live Gemini and open/refresh a regression issue on failure. NEW tests are
        real behavioral: media-gen.test.ts:157-184 + staging.test.ts:159-225 drive degrade/timeout/provider-throw/off-type
        via injected fake providers + audit-before-spend ordering; billing/index.test.ts:75-108 isTrialEligible edges;
        experiments.test.ts:227-322 significance/under-powered/zero-base. evaluate.mjs:94-100 BLOCKS any undeclared
        env-gated test.skip; all 26 skips are honest env gates (!RUN_EVALS/!DB/!CAPTURE_DIR). A→A+ nit: the coverage
        ratchet is loose on 3 of 4 axes — actual ~87.7/87.8/91.2 vs floors 70/84/76, so lines/stmts/functions carry
        15-17pt slack and only branches (84 vs 87.83, ~3.8pt) ratchets tight; a regression could delete a large untested
        block and pass. Tighten lines/stmts/functions to ~85 to close. Evals themselves are non-vacuous → A not lower.
    - name: artifact_integrity
      grade: A
      ship_critical: false
      evidence: >-
        check-self-validation.mjs → exit 0 (8 capabilities, 8 active); --readiness → exit 0 (unmet [], unmet_unsurfaced []).
        Manifest verified HONEST, not gamed-green: the NEW 8th capability marketing-media-gen genuinely exercises its
        code — media-gen.test.ts:104-185 injects a fake MediaProvider into the REAL MediaGenClient and asserts success
        mapping (image bytes / video operation name / inline audio → asset) PLUS throw/empty/timeout → error degrade, and
        audit-first ordering (slop rejected with no key → rejected not unavailable, so the gate precedes the key check);
        staging.test.ts:76-226 drives stageCreative across a 4-format brief (tally, metadata-only manifest, no-key degrade,
        audit-rejection spends nothing, one-bad-one-good continues, throwing-client guard). billing/index.test.ts:131-188
        genuinely exercises the #487-extracted RevenueCat map. e2e assertions are real outcomes (journeys.spec.ts:57-59,
        243-248); the only e2e skip is email-roundtrip.spec.ts:46 gated on the DECLARED EMAIL_CAPTURE_DIR. Docs consistent:
        pricing agrees across billing/index.ts (499/3999/999/7999), upgrade/page.tsx, BUSINESS_CASE.md; tier naming
        "Premium" everywhere (zero "Pro" leak). A→A+ nit: marketing-media-gen is fully built + well-tested but has NO
        product-reachable caller yet (@gm/core/media has no importer outside its own dir) — a capability proven in
        isolation rather than end-to-end in a shipping flow; honestly disclosed as staging-only, so over-coverage not gaming.
    - name: business_case
      grade: A
      ship_critical: false
      evidence: >-
        Independently recomputed all three scenarios to the dollar: base 1500×0.45×0.04=27/mo ÷0.037 → 730 ×$3.82×12 =
        $33,463 ≈ $33,450 ✓ (blended churn 3.71% ✓, ARPU $3.82 ✓); conservative 500×0.35×0.025 ÷0.065 → 67 ×$3.82×12 =
        $3.1K ✓; optimistic 6000×0.55×0.06 ÷0.030 → 6600 ×$4.32×12 = $342K ✓. floor_met_year1:false stated HONESTLY
        (base steady-state $33.45K < $100K floor, restated in header/§4/§5/§8); base 4% signup→paid is upper-mid of the
        cited freemium band (OpenView/Amplitude 2-5%), and the doc STAMP self-corrects a prior gamed 12.6% conversion
        down to 4%. Prices CODE-SOURCED and match exactly: billing/index.ts:43,59,69-70 (499/3999/999/7999) ⇔ doc §1.
        Growth levers BUILT not stubs: referral/rewards.ts:36 MAX_REWARD_MONTHS hard cap; growth/experiments/stats.ts:46
        -105 two-proportion z-test + Wilson CI (returns null on insufficient data); cohort-retention.ts:70-115 one
        set-based CTE no N+1; UTM analytics; H14/H15 lifecycle crons present. Media adapter is real (audit-first + degrade),
        honestly labeled staging-only. A→A+ nit: the machine-readable header field is STILL literally named arr_year1
        while holding the steady-state run-rate ($33,450), with literal year-1 ≈$6,500 in §4 — DISCLOSED in the adjacent
        comment (a naming nit, not hidden inflation). Rename to arr_steady_state to remove the last machine-read ambiguity.
    - name: performance
      grade: B
      ship_critical: false
      evidence: >-
        Both standing gaps re-confirmed still open (held at B, unchanged from #320, 5th cycle). (1) NO CI perf-budget
        gate: grep of .github/workflows/*.yml for bundlesize|lighthouse|size-limit|budget = only 2 prose comments
        (ci.yml:186, evals.yml:28), zero assertion; ci.yml:66 gates only on missing-export grep, no size assertion.
        (2) Edge middleware 280,299 bytes raw (ls -la .next/server/middleware.js) — BYTE-IDENTICAL to last cycle (no
        creep this time, but no trim): middleware.ts:1,6 imports NextAuth→jose onto the edge runtime, broad matcher
        (:130) runs it on nearly every non-static request; the 88.6 kB reported figure is only the gzip. Good hygiene
        keeps it off C: stockLedger composite ledger_user_item_idx (schema.ts:466) covers reprojectStock; 0020
        meal_logs(user_id,cooked_at); 0001 trgm GIN + HNSW vector_cosine_ops; cohort-retention.ts:72-107 one set-based
        CTE no N+1; LLM cheap-first ladder; media adapter wall-clock bounded (withTimeout, no unbounded poll). Recent
        perf commits (#457 Promise.all tenant reads, #467 parallel ask-brief) are real latency wins but add neither a CI
        budget nor edge-bundle slimming. It remains the only NON-ship-critical dim below A (≥B satisfies the gate here).
  # Ordered: the ship-critical below-A dim first (it breaks the gate), then the non-ship-critical below-A dim, then bounded A→A+ polish on already-A ship-critical dims.
  top_gaps:
    - dimension: design_taste
      ship_critical: true
      gap: >-
        SHIP-CRITICAL, below A — breaks the ship gate. The native Expo app (apps/mobile, in active App Store/Play submission
        scope per eas.json) has NO icon system (zero icon-library deps, no SVG/icon components) and uses ~110 raw-glyph
        affordances as icons: cook/[id].tsx:101,119,160,174,229; index.tsx:43-91; recipes.tsx:117 (›); onboarding.tsx:256;
        upgrade.tsx:158 (✓). Plus a residual web nit: cook/[id]/page.tsx:182 raw ▾ where ChevronDown (icons.tsx:53) is
        registered-but-unused. To raise to A: add an icon system to apps/mobile (e.g. @expo/vector-icons) and replace the
        ←/→/›/✓ chrome with real icons — the same fix the web cook-mode already received (#486) — and swap the web ▾ to
        ChevronDown. NOTE for the loop: this is a re-assessment surfacing a LONG-STANDING gap (mobile glyphs predate this
        cycle), NOT a fresh code regression — but it is the single thing between the product and a met ship gate. Tracked
        in a new quality issue.
    - dimension: performance
      ship_critical: false
      gap: >-
        (a) Add a CI perf-budget gate (size-limit / bundlesize / lighthouse-ci, or even a wc -c guard) enforcing middleware
        + per-page first-load ceilings so bundle regressions fail the build. (b) Trim the 280,299-byte edge middleware —
        move the next-auth/jose session read off the edge runtime (lightweight edge-safe JWT decode) or narrow the matcher
        (middleware.ts:1,6,130). Non-ship-critical (≥B satisfies the gate). Tracked in issue #320 (open + accurate; byte
        figure unchanged — no creep this cycle).
    - dimension: launch_readiness
      ship_critical: true
      gap: >-
        A→A+ polish only (at the ship bar): the only remaining incompleteness is owner-supplied — eas.json submit
        placeholders (OWNER_APPLE_ID/ascAppId/appleTeamId) and a few "owner decision required" data-safety classification
        flags in privacy-disclosures.md. Legitimate human-in-the-loop gates, not code defects; do not block.
    - dimension: security
      ship_critical: true
      gap: >-
        A→A+ polish only (at the ship bar): rate-limit + demo LLM-spend ceiling are in-memory per Node process
        (rate-limit.ts, demo-quota.ts:54-55), so under Vercel horizontal scale the "global" cap becomes 500×instances.
        Bounded (captcha + per-IP layered on top) + documented; needs the Upstash-Redis backing already in PENDING_OPS
        (llm-quota-redis-upgrade) before the single-absolute-cap claim holds at scale.
```

## Notes for the factory loop (consume, don't self-grade)

- **Ship gate is NOT met this cycle** because the ship-critical `design_taste` dimension is graded
  **B**. **Read this correctly: it is a RE-ASSESSMENT, not a code regression.** A more thorough design
  grader surfaced a long-standing gap prior cycles under-weighted — the native `apps/mobile` app has
  **no icon system at all** and uses ~110 raw Unicode glyphs (`← Back`, `Next →`, `›`, `✓`) as icons,
  while the web PWA has a full hand-built registry. The mobile app is in active store-submission scope
  (`eas.json`), so its iconography is a shippable-surface gap, not cosmetic. The code did not get worse
  since 07-09 (only #512 a11y labels + #495 tier label touched mobile).
- **The single highest-leverage fix to re-close the gate:** give `apps/mobile` an icon system (e.g.
  `@expo/vector-icons`) and replace the `←/→/›/✓` glyph chrome with real icons — the same fix the web
  cook-mode already received in #486 — plus swap the residual web `▾` (`cook/[id]/page.tsx:182`) to the
  already-registered `ChevronDown`. Filed as a new `quality` issue.
- **The rest of the product improved or held.** `functional_reality` rose **A → A+** (throw-safe auth
  #517, zero fake data, all journeys real). Three previously-standing A→A+ nits were genuinely closed:
  RevenueCat event-map extracted + table-tested (#487, closes the 3-cycle launch nit), cook-mode arrow
  glyphs → registry icons (#486), and the #504 ask-quota throw-path under-count fixed + regression-tested.
  The new §11 media-gen adapter (#509/#515) was audited **HONEST** — its manifest tests genuinely
  exercise it via injected fake providers (not a gamed-green capability).
- **`performance` (B) is unchanged** (issue #320): still no CI perf-budget gate; the raw edge bundle is
  **byte-identical** at 280,299 (no creep, no trim). Non-ship-critical — it does not affect the gate,
  which is blocked solely by `design_taste`.
