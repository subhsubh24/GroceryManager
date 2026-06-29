# GroceryManager — Quality Scorecard

> **Independent grade** assigned by the separate Quality Auditor routine (maker ≠ checker). The
> factory loop CONSUMES this as a DATA signal and never authors/overwrites it. Every grade below is
> backed by a mechanical signal the grader actually ran this cycle, plus file/line evidence. Grades
> may not exceed what the signals support. See `QUALITY_RUBRIC.md` for the scale and dimensions.

**As of 2026-06-29.** Overall: **B**. Ship gate: **NOT met** — two ship-critical dimensions
(`correctness_reliability`, `launch_readiness`) are at **B**; the ship bar is **A/A+** on every
ship-critical dimension. The product is strong and near-ship — functional journeys work end to end,
security is hardened, the design clears the VISION taste bar, and the business case is honest — but
two named, buildable gaps stand between it and the A ship bar.

```yaml
QUALITY_SCORECARD:
  as_of: 2026-06-29
  overall: B
  ship_gate_met: false
  graded_by: independent-quality-auditor   # maker != checker; one fresh adversarial subagent per dimension
  mechanical_signals:
    typecheck: pass                          # pnpm -r run typecheck → exit 0
    core_tests: pass                         # pnpm --filter @gm/core test → exit 0; 86 test files; vitest coverage thresholds (lines70/branches84/functions76/statements70) met
    prod_build: pass                         # NODE_ENV=production next build → exit 0; no missing-export warnings; 102 kB shared first-load
  dimensions:
    - name: functional_reality
      grade: A
      ship_critical: true
      evidence: >-
        Signup→onboarding→home, list→cook→buy, and ingestion→pantry→reorder all wired to real
        withTenant DB queries (signup/page.tsx:57-78, list/page.tsx:15-44, add-receipt/actions.ts:44-113,
        pantry/persist.ts appendLedgerAndReproject). No fake data on success paths; loadHomeData()
        returns honest EMPTY_HOME_DATA on error. journeys.spec.ts asserts outcomes, not just renders.
    - name: correctness_reliability
      grade: B
      ship_critical: true
      evidence: >-
        Logic sound (EWMA skips zero-day intervals; shelf-life grace ceiling; LLM calls try/catch and
        degrade; missing keys no-op). BUT vision/persist.ts:110-112 writes pantryStock directly after
        appendLedgerAndReproject — violates the ledger-only invariant (semantically harmless but real).
        And vision detect.ts/persist.ts/resolve.ts + recipe/generate-llm.ts ship at ~0% coverage on a
        core "pantry fills itself" path.
    - name: security
      grade: A
      ship_critical: true
      evidence: >-
        All ~35 API routes auth-enforced (withTenant+RLS / verifyMobileToken HMAC constant-time /
        Bearer JWT / isCronAuthorized timing-safe). RLS deny-by-default with app_current_user_id() GUC
        set per transaction (0002_rls.sql, client.ts:78-86). Server-side entitlement (llm-quota.ts),
        Stripe constructEvent verified, encrypted OAuth tokens, rate limits + 32KB body caps + OWASP
        headers (next.config.mjs). Only minor documented CORS/CSP tradeoffs.
    - name: design_taste
      grade: A
      ship_critical: true
      evidence: >-
        Real token system (tailwind.config + globals.css, Hanken Grotesk, restrained green accent,
        consistent spacing scale) — not default Tailwind/shadcn. Empty/quiet states instead of fake
        data (page.tsx EMPTY_HOME_DATA; "Nothing due right now"). Systematic a11y (labeled inputs,
        aria-labels on icon buttons, 16px mobile inputs). No card spam / rainbow accents across
        marketing, onboarding, dashboard, paywall screenshots.
    - name: launch_readiness
      grade: B
      ship_critical: true
      evidence: >-
        Store assets real (icon-1024/512/192 + feature-graphic PNGs), privacy/terms substantive,
        account deletion implemented (profile + mobile API, ON DELETE CASCADE), web Stripe wired,
        eas.json prod profiles, ACCEPTANCE_AUDIT vs June-2026 guidelines. BUT mobile RevenueCat IAP is
        a disabled "Payments coming soon" stub (apps/mobile/app/upgrade.tsx:71) with no
        Purchases.purchasePackage() call — an App-Store-targeted app that cannot accept payment on
        device is not submittable; the SDK call is buildable (could degrade like web Stripe).
    - name: tests_evals
      grade: B
      ship_critical: false
      evidence: >-
        86 test files, coverage thresholds enforced + met; 5 real LLM evals with golden fixtures +
        pass-rate assertions (extraction/meal-gen/capture/recipe-import/remix .eval.test.ts); high
        test quality for covered modules (consume/depletion/units/shelf-life). BUT vision pipeline
        (detect/persist/resolve) + logCook orchestration (7.97%) untested; no vision-quality eval.
    - name: artifact_integrity
      grade: B
      ship_critical: false
      evidence: >-
        ~95%+ of spot-checked ticked DoD boxes backed by real artifacts; pricing matches code exactly
        ($4.99/$39.99/$9.99/$79.99 in billing/index.ts == BUSINESS_CASE.md); no docs-contradict-code
        bugs found in Stripe/mobile/security/marketing. BUT ROADMAP Track F4 ticks "performance
        budgets" as done while no CI perf-budget gate exists (per performance audit) — a ticked claim
        without its artifact.
    - name: business_case
      grade: A
      ship_critical: false
      evidence: >-
        Honest: floor_met_year1=false, median base ~$33K/yr vs $100K floor, with prior gamed 12.6%
        conversion explicitly corrected to the cited 2-5% freemium benchmark. Prices sourced from
        billing/index.ts; churn/ARPU/signup benchmarks cited (Amplitude/Baremetrics/AppTweak). Growth
        engine BUILT not listed (experiments, referral rewards, lifecycle email, UTM — migrations
        0012-0019 + packages/core/src/growth + referral). LLM cost capped (llm-quota.ts).
    - name: performance
      grade: B
      ship_critical: false
      evidence: >-
        Hot paths indexed (0001/0008/0020 migrations); no N+1 in reprojectStock/digest/reorder (single
        joins + Promise.all batching); force-dynamic pages avoid static bloat; LLM cheap-first ladder
        wired (flash-lite→flash→pro, models.ts/client.ts). BUT no CI perf-budget gate (no
        lighthouse/bundlesize) and middleware ~276 KB uncompressed.
  # Ordered by ship-criticality then leverage. Ship-critical-below-A gaps come first.
  top_gaps:
    - dimension: launch_readiness
      ship_critical: true
      gap: >-
        Wire mobile in-app purchase: replace the disabled "Payments coming soon" CTA at
        apps/mobile/app/upgrade.tsx:71 with a real Purchases.purchasePackage() flow that degrades
        gracefully when REVENUECAT_API_KEY is absent (mirror the web Stripe pattern). Until then the
        app cannot accept payment on device and is not App Store / Play submittable.
    - dimension: correctness_reliability
      ship_critical: true
      gap: >-
        (a) Remove the direct pantryStock write at packages/core/src/vision/persist.ts:110-112 (route
        all stock mutation through appendLedgerAndReproject — the stated invariant). (b) Add unit +
        integration tests for the vision pipeline (detect/persist/resolve) and logCook orchestration,
        mirroring ingest.integration.test.ts, so the core "pantry fills itself" path is exercised.
    - dimension: tests_evals
      ship_critical: false
      gap: >-
        Cover the vision pipeline + logCook (currently ~0% / 7.97%) with unit+integration tests and add
        a vision-quality eval (golden screenshot + LLM-judge on item-count accuracy). Overlaps the
        correctness coverage gap.
    - dimension: performance
      ship_critical: false
      gap: >-
        Add a CI performance-budget gate (bundlesize or lighthouse-ci) enforcing middleware < ~150 KB
        and per-page first-load < ~90 KB; trim the ~276 KB uncompressed middleware bundle.
    - dimension: artifact_integrity
      ship_critical: false
      gap: >-
        Reconcile ROADMAP Track F4: either build the CI perf-budget gate it claims ("performance
        budgets") or correct the ticked claim so the doc matches reality.
```

## Notes for the factory loop (consume, don't self-grade)

- **Ship gate is blocked by two ship-critical B's.** Drive `launch_readiness` and
  `correctness_reliability` to A — both gaps are buildable and named above.
- The single highest-leverage fix is the **mobile IAP wiring**: it is the only gap that hard-blocks
  store submission. The web billing path is already complete; the mobile path lags it.
- The correctness + tests gaps **share a root cause** — the vision-scan ingestion path is real,
  shipping logic that is untested and contains an invariant violation. Fixing it closes two gaps.
- Non-ship-critical dimensions are all ≥ B; no dimension is below B. No dimension is ungraded.
