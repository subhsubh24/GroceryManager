# Loop health — is the LOOP getting better, or just busier?

The `QUALITY_SCORECARD` measures the **product**; this measures the **loop itself** (FACTORY_STANDARD §10b).

**Contract (read before editing):**
- **Update EVERY run, in the bookkeeping PR**, with REAL counts — `git log`/`gh` for merged/revert/readiness
  history + this run's own shipped/abandoned/verify/review/circuit-breaker tallies.
- **Honest only** — same anti-gaming rule as the business-case number. Never flatter a count; an ugly
  `churning`/`stuck` signal is the POINT (it triggers a harness proposal). `0`/`null` until real.
- **CLASSIFY every abandoned change** (`abandoned_reasons`) so the loop does NOT re-attempt the same dead-end
  — "don't repeat the failed path."
- **Dashboard-readable** — keep the fenced `LOOP_HEALTH` block valid, parseable YAML.
- **Refresh the `validation` sub-block every run** from `node scripts/check-self-validation.mjs --readiness`
  (`capabilities_total`/`active`/`unmet`/`unmet_unsurfaced`). Any **unmet** capability (one needing an owner
  secret the loop can't supply) MUST appear in BOTH `validation.unmet` here AND an urgent `OWNER_ACTION`
  `validation-capability-<service>` in `PENDING_OPS.md`; `unmet_unsurfaced` must stay empty.
- **Observability, NOT a ship gate** — this never blocks a merge or readiness; it informs.
- `signal` honest read: `churning` (high abandon/revert vs. shipped) or `stuck` (recurring failures / no
  convergence) → open ONE `loop: harness improvement proposal` issue (the META channel — the only way the
  loop's OWN rules improve, since it can't edit its routine / `.claude/`).
- `abandoned_reasons` enum is adapted to THIS stack (pnpm/Turborepo web + Expo mobile): `gate_tsc`
  (`pnpm -r run typecheck`), `gate_test` (`@gm/core` vitest), `gate_build` (`next build` + missing-export
  grep), `gate_mobile` (`apps/mobile` typecheck), `review_value`, `review_correctness`, `circuit_breaker`,
  `conflict`, `dead_end`, `blocked_owner`.

```yaml
LOOP_HEALTH:
  project: GroceryManager
  as_of: 2026-07-10 (run 59)
  enforced_in_ci: true           # lint + functional E2E journeys + the capabilities tripwire are REQUIRED checks on main, enforce_admins=true
  validation:                    # capability self-validation feed — refresh every run from `node scripts/check-self-validation.mjs --readiness`
    enforced_in_ci: true         # 'self-validation (capabilities tripwire)' is a required, enforce_admins status check
    capabilities_total: 7        # +invite-code-redeem (run 56, PR #475) — proven keyless (16 unit tests + journeys.spec reachable/generic-reject/405)
    active: 7
    unmet: []                    # capabilities needing an OWNER SECRET not wired in CI (loop can't supply) — each MUST also be an urgent OWNER_ACTION 'validation-capability-<service>' in PENDING_OPS
    unmet_unsurfaced: []         # MUST stay empty — an unmet capability missing from PENDING_OPS or this list is invisible to the owner (a bug)
  last_run: 2026-07-10 (run 59)
  last_deep_audit: "2026-07-10 (run 59, standalone 5-Haiku lens sweep, due since run 57 / ~4 runs: security/RLS+Track-G, correctness/dead-code+functional-reality, test-coverage+performance, design/a11y/taste, artifacts+business-case — 2 real findings shipped + 1 reviewer-surfaced follow-on, everything else CLEAN. SECURITY/RLS/Track-G: CLEAN — all public tables through 0021 RLS+policy, rate-limits/captcha/HMAC/webhook-auth (Stripe constructEvent + timing-safe RevenueCat/Gmail/cron/site-gate)/headers/CORS/per-user LLM quota all present, AES-256-GCM at rest, no new hole since 0021. CORRECTNESS/FUNCTIONAL: CLEAN — all server actions + routes try/catch→degrade, run-57 pantry wraps hold, LLM withTimeout(8s), DATABASE_URL fails-loud, no uncaught throws/dead-ends on critical paths. TEST/PERF: CLEAN above marginal — 912 tests / coverage 87/88/91 > thresholds, recent bug-fixes all landed with regression tests; ingest/capture N+1 + sequential-insert candidates STILL rejected (LLM-bound, <2% on a correctness-sensitive path — run-38/41 verdict); rankRecipes batchCook weighting untested but dormant/never-applied (not a bug). DESIGN: 1 real customer-facing shipped (#491 — meal-generator.tsx:97 literal ▾ disclosure glyph → <ChevronDown> registry icon, the lone glyph left after cook-mode #479/#486; inline → text-link arrows correctly NOT flagged — established convention). ARTIFACTS: 1 real store-risk shipped (#492 — privacy-disclosures.md §1.4 falsely declared 'NO in-app purchases or subscriptions' while RevenueCat mobile + Stripe web subscriptions are wired at 499/3999/999/7999 cents; corrected §1.4→YES + Play data-map row + Apple checklist, §1.5 payment-credentials stays NO; prices byte-verified vs packages/core/src/billing) + 1 reviewer-surfaced follow-on (#493 — @gm/core/billing header comment 'SCAFFOLD ONLY (no real payments yet)' contradicted wired billing → corrected, comment-only). BUSINESS_CASE prices/ARR/floor byte-consistent (base $33,450, floor_met false). Reach-gated RE-CONFIRMED (base ≈ $33K < $100K = owner-GTM #190; no buildable floor-mover in the sweep). Prior standalone run 57 (~4 runs ago).)"
  this_run:
    changes_shipped: 3           # DEEP AUDIT (5-Haiku lens) + 3 file-disjoint clears, all 2/2 Sonnet-approved first-pass, 0 abandons. #491 (design — meal-generator.tsx:97 literal ▾ disclosure glyph → <ChevronDown> registry icon, the lone customer-facing glyph after cook-mode #479/#486; icons.tsx registers ChevronDown beside ChevronRight). #492 (store-compliance/living-artifact — privacy-disclosures.md §1.4 declared 'NO in-app purchases or subscriptions', FALSE vs wired RevenueCat/Stripe subs; corrected §1.4→YES + Play data-map row + Apple checklist, §1.5 stays NO for card data; a false store data-safety label is a review-rejection risk). #493 (living-artifact — @gm/core/billing header comment 'SCAFFOLD ONLY (no real payments yet)' contradicted wired billing; corrected, comment-only; surfaced by #492's Reviewer A). No DoD box completed (Track-F/G polish + artifact fixes, not new DoD items).
    changes_abandoned: 0
    abandoned_reasons: []
    verify_cycle_failures: 0     # Gate green on every branch first-pass (typecheck 0 all packages, 912 core tests, production build clean 0 missing-export, self-validation 7/7). All required CI checks (verify/lint/mobile/migrations/e2e/self-validation) green first-pass; no re-runs.
    review_rejections: 0         # 6 Sonnet reviews (2 per PR × 3 PRs); ALL APPROVE first-pass. Reviewer A on #492 fact-checked every price byte-for-byte vs packages/core/src/billing and, while there, surfaced the stale billing scaffold comment → became the file-disjoint #493.
    review_cycles_used: 1        # single review pass per PR; no fix cycles.
    circuit_breaker_trips: 0
    findings_rejected: 3         # (with evidence, churn-avoided) inline → text-link arrows (established typographic convention, not glyph-button; churn across ~10 files); rankRecipes batchCook weighting (untested but dormant/never-applied, not a bug); ingest/capture N+1 + sequential inserts (LLM-bound flow, <2% on a correctness-sensitive path — run-38/41 verdict re-confirmed). #320 performance-B deferred a 5th run (CI perf-budget gate needs forbidden .github; middleware trim is a high-blast auth refactor for a non-ship-critical A→A+ nit). Business case: no buildable floor-mover (reach-gated #190).
  rolling_7d:
    merged_prs: 97               # + run-59 #491/#492/#493 (this bookkeeping in flight); many are FACTORY/GTM/growth meta-commits
    reverts: 0
    readiness_attempts: 0
    readiness_rejected: 0
    recurring_failures:          # short bullets: the SAME wall hit across ≥2 runs (→ harness proposal if it persists)
      - "STALE local origin/main (run 44): the env cloned + checked out the run-43 tip (d48c0dd/#385) as a DETACHED HEAD, but local `origin/main`/`main` refs still pointed at #369 (14 commits behind). Branching from `main` cut the feature branch off stale #369, which made #379's merged worker-stub fix APPEAR reverted (the pre-#379 `stub()` was on the stale base, not real main). RESOLVED: `git fetch origin main` fast-forwarded origin/main to #385, confirmed #379 IS merged (no regression), then `git branch -f main origin/main` + rebased the feature branch onto real main (clean — file-disjoint). LESSON: ALWAYS `git fetch origin main && git branch -f main origin/main` (or branch from `origin/main`, not `main`) at run start BEFORE trusting local main / diagnosing a 'missing fix' — a stale ref manufactures phantom regressions. RECURRED run 53: local `main` was 36 commits behind origin/main; branches cut from it carried phantom diffs (#451's wrapped `empty` reformatting appeared as mine). Same fix — `git reset --hard origin/main` then recreate branches from stash (only wrapped.tsx had changed upstream; the stash already contained #451, so per-file checkout = origin/main + my edit). 3rd occurrence (runs 44, 53, 56). Run 56 exposed a GAP in the standing mitigation: the run-start `git reset --hard origin/main` ran on a DETACHED HEAD, so it moved HEAD but NOT the local `main` REF — then `git checkout -b <branch> main` still cut from stale `main` (missing run-55's `/demo` middleware, looked like a regression). Caught immediately via `git show origin/main` + fixed by `git branch -f main origin/main` and recreating the branch from `origin/main`. BENIGN (no bad merge). Standing mitigation UPGRADED: branch explicitly from `origin/main` (`git checkout -B <branch> origin/main`) — never from local `main` — and `git branch -f main origin/main` at run start. 3rd occurrence → harness proposal opened (`loop: harness improvement proposal`) to make the run-start sync detached-HEAD-safe."
      - "branch-entanglement (runs 39, 41): a review/build subagent sharing the parent git working tree ran a checkout that left the tree a MIX on top of the correct pushed commit. HARMLESS both times — commits were already pushed; verify origin/<branch> via `git show` (not the shared tree) + `git reset --hard HEAD` to recover. Persistent-but-benign; mitigation = worktree isolation for mutating parallel agents. No harness proposal (no lost work, no red merge)."
      - "recurring #0a6e33 re-flag (runs 35, 41): a design scout keeps proposing `brand-solid` for the deep-green-on-white hardcode (an AA regression). RESOLVED in #372 by moving to the byte-exact `brand-solid-hover` token + an in-code contrast comment at each site — the re-flag can't recur. No harness proposal needed."
      - "admin low-value design re-flag (runs 48, 49, 50): a design scout keeps surfacing internal-admin design nits — run 48/49 the `text-brand-solid`→`-hover` contrast INVERSE trap (`brand-solid`/`-hover` are SURFACE tokens, correct for `bg-*` where hover=darker, but as `text-*` FOREGROUND on the near-black admin bg darker = LESS contrast, a dark-mode regression, why #424 was abandoned); run 50 the admin/growth + admin/waitlist section-title `<p>` semantics (WCAG 1.3.1) + raw `text-amber-600`/`text-green-600` tokens. All admin is owner-internal, never store-reviewed, low-surface — deferred each time (run-45 precedent) to a dedicated admin design/dark-mode pass, never a per-element hack. Watch: if admin design re-flags again, either do the one dedicated admin pass (mode-aware foreground token + `<h2>` section titles + semantic status colors) OR add in-code comments at each admin site (like #372 did for the light-mode case) to stop the recurring re-flag."
      - "Haiku-scout false positives keep needing re-verification (runs 42,43,44,45,47): a cheap scout produces a plausible 'bug' against a deliberate design (ewmaConsumptionRate; server-action raw throws; recipe alt='') or an environment artifact (mobile '771 TS errors' = deps-not-installed). MITIGATION already in the loop: the orchestrator VERIFIES every scout finding before selecting (design intent at the site; `npm ci` before a mobile typecheck; adjacent-text check before an alt='' 'fix'). Working as intended — the verify step catches them; NOT a harness proposal (the model split expects cheap scouts to over-report; the maker's verification is the guard)."
    harness_proposals_open: 1    # run 56: #476 — make the run-start local-main sync detached-HEAD-safe (stale-main trap 3rd occurrence, runs 44/53/56). (#232 resolved by #234.)
  signal: steady                 # bootstrapping | improving | steady | churning | stuck
                                 #   run 59: 3 file-disjoint clears (#491 design glyph→ChevronDown / #492 privacy-disclosure
                                 #   IAP correction / #493 billing scaffold-comment correction), 0 abandons, 6 Sonnet reviews
                                 #   (2/PR) ALL APPROVE first-pass, 0 verify-cycle failures, all required CI green first-pass.
                                 #   Full standalone 5-Haiku DEEP AUDIT (due since run 57): security/RLS+Track-G, correctness/
                                 #   functional, test-coverage+perf, design/a11y, artifacts/business-case — all CLEAN except the
                                 #   2 shipped design/artifact findings; #493 was a free second-audit find (Reviewer A noticed a
                                 #   stale comment while fact-checking #492's prices). Convergence stays reach-gated (#190, base
                                 #   ≈ $33K < $100K, owner-GTM; sweep found no buildable floor-mover); did NOT open 'ready';
                                 #   Confidence stays UNCHECKED. Validation 7/7, 0 unmet.
                                 #   -- prior run 56: 3 shipped (§34 Part B invite-code FLAGSHIP #475 + #474 mobile array-guard +
                                 #   #473 a11y triangle), 0 abandons, 6 Sonnet reviews (2/PR). Flagship took 2 review cycles:
                                 #   Reviewer A caught a REAL security defect (redeem granted the literal master
                                 #   SITE_GATE_PASSWORD to invitees) → fixed with a distinct SITE_GATE_INVITE_SECRET; cycle-2
                                 #   B caught dead getWaitlistInviteStats → wired into the issuance script; both re-APPROVE. CI
                                 #   caught 1 e2e locator strict-mode bug (getByLabel regex vs section aria-label) → fixed. The
                                 #   maker≠checker + real-browser e2e gates BOTH earned their keep. Stale-local-main trap recurred
                                 #   3rd time (detached-HEAD gap) → harness proposal opened. Convergence stays reach-gated (#190,
                                 #   base ≈ $33K < $100K, owner-GTM); did NOT open 'ready'; Confidence stays UNCHECKED. Validation 7/7.
                                 #   -- prior run 54: 4 file-disjoint clears, 0 abandons, 8 Sonnet reviews (2 per PR) ALL APPROVE
                                 #   first-pass (0 re-reviews). Standalone 6-Haiku DEEP AUDIT (due since run 53, ~2 days)
                                 #   covering all 8 areas: security/RLS+Track-G, correctness, design/a11y, monetization+
                                 #   business-case, mobile+perf, coverage+artifacts — 0 CRITICAL; security + coverage +
                                 #   artifacts CLEAN; monetization reach-gated RE-CONFIRMED (pricing MATCHES, no bugs; the
                                 #   annual-first/promo levers are A/B-experiment territory, not bankable — no buildable
                                 #   floor-mover). #464/#465 hardened the add-receipt+scan pre-LLM quota-gate DB read (uncaught
                                 #   throw → inline {status:error}, the #436/#437/#448 class on 2 core-loop vision paths).
                                 #   #466 a11y scan radio fieldset/legend (WCAG 1.3.1). #467 perf ask 7 sequential brief reads
                                 #   → Promise.all (#457 pattern, premium path). 3 scout false positives verified against real
                                 #   code + rejected (mobile onboarding res.ok no-op; upgrade aria-current is valid-in-a-set;
                                 #   aria-disabled redundancy churn) — the maker-verify guard earned its keep again. Convergence
                                 #   stays reach-gated (#190, base ≈ $33K < $100K, owner-GTM); did NOT open 'ready'; Confidence
                                 #   stays UNCHECKED. Validation 5/5, 0 unmet.
                                 #   -- prior run 52: 5 file-disjoint clears, 0 abandons, 10 Sonnet reviews (2 per PR): 9 APPROVE +
                                 #   1 REQUEST_CHANGES (honored — #449 drop redundant aria-label, keep aria-pressed). No deep
                                 #   audit (run 50 same day). 5-Haiku scout sweep; security + artifacts CLEAN. #447 push
                                 #   {ok}-contract + fake-"Notifications are on" fix; #448 import save DB-degrade; #449 cook
                                 #   aria-pressed; #450 spend week-branch test (+1, 872 total); #451 mobile Wrapped empty-state.
                                 #   Lesson: grep over raw subagent JSONL matched prompt-echo verdicts (3 phantom rejections);
                                 #   trust the completion-notification <result>. Convergence stays reach-gated (#190, base ≈ $33K
                                 #   < $100K, owner-GTM); did NOT open 'ready'; Confidence stays UNCHECKED. Validation 5/5, 0 unmet.
                                 #   -- prior run 50: 2 file-disjoint clears, 0 abandons, 4 Sonnet reviews (2 per PR) all APPROVE
                                 #   first-pass (0 re-reviews). Full 6-lens DEEP AUDIT (due since run 47, 3 runs): security/RLS+
                                 #   Track-G, correctness/dead-code, artifacts, perf/deps, design/a11y, mobile+functional — 5 CLEAN,
                                 #   1 design deferred (low-value internal-admin), 1 mobile cluster shipped. #429 completed the #427
                                 #   mobile/v1 route error-hardening sweep — 3 uncaught DB throws (recipes/[id], v1/pantry, v1/list)
                                 #   wrapped + serverError() (an uncaught HTML 500 to a JSON mobile client), + 6 bare catches given
                                 #   the missing G3 server-side log. #430 covered the untested UnitConverter item_base 2-hop BFS chain
                                 #   (4 exact-value tests; a dormant-but-real pure engine). Monetization/business-case re-confirmed
                                 #   reach-gated (no buildable floor-mover). Convergence stays reach-gated (#190, base ≈ $33K < $100K,
                                 #   owner-GTM); did NOT open 'ready'; Confidence stays UNCHECKED. Validation 5/5, 0 unmet.
                                 #   -- prior run 49: 2 file-disjoint clears, 0 abandons, 6 Sonnet reviews (4 first-pass + 2 re-review)
                                 #   all APPROVE. No deep audit (run 47 same day). 5-Haiku scout sweep. Security CLEAN (only
                                 #   known/owner items). #426 fixed a real mobile conversion dead-end — a discriminated-union
                                 #   API response cast to just its happy arm dropped the free-user paywall behind a cheerful
                                 #   "all caught up" empty state; typed the union + rendered the upgrade prompt. #427 hardened
                                 #   3 mobile routes (auth/profile/onboarding) that called the DB outside try/catch → uncaught
                                 #   500; wrapped to a controlled 503, and Reviewer B's should-fix added the missing G3
                                 #   server-side log (bare catch → catch(err)+console.error). Monetization reach-gated
                                 #   reconfirmed (Family-tier mobile "gap" is a RevenueCat OFFERING = owner config, not code).
                                 #   Convergence stays reach-gated (#190, base ≈ $33K < $100K, owner-GTM); did NOT open 'ready';
                                 #   Confidence stays UNCHECKED. Validation 5/5, 0 unmet.
                                 #   -- prior run 47: 3 file-disjoint clears, 0 abandons, 7 Sonnet reviews (incl. 1 re-review) all
                                 #   APPROVE. Full 6-lens DEEP AUDIT (due since run 45): security/RLS+Track-G, correctness,
                                 #   artifacts, monetization, design/a11y, mobile+perf+test — NO CRITICAL findings; security +
                                 #   correctness + artifacts CLEAN; monetization RE-CONFIRMED reach-gated (no buildable
                                 #   floor-mover). #418 completed the #372 brand-solid-on-white AA sweep (last 4 CTA outliers,
                                 #   4.45:1→6.4:1). #419 gave the previously-untested experiment-stats module 15 tests + a
                                 #   sign-bug MONOTONICITY guard (Reviewer A reimplemented + simulated the bug to confirm it's
                                 #   load-bearing). #420 closed a real mobile parity gap — the cook screen promised an "I cooked
                                 #   this" button that didn't exist; new POST /api/mobile/cook mirrors the proven web logCook
                                 #   path; Reviewer B's design catch (bottom placement + real servings) made it right. 2 scout
                                 #   false positives correctly rejected (recipe alt="" decorative-correct; mobile "771 errors" =
                                 #   deps-not-installed). Convergence stays reach-gated (#190, base ≈ $33K < $100K, owner-GTM);
                                 #   did NOT open 'ready'; Confidence stays UNCHECKED. Validation 5/5, 0 unmet.
                                 #   -- prior run 46: 3 file-disjoint clears, 0 abandons, all 6 reviewers APPROVE. Worked the
                                 #   open-issue backlog + a lean 3-Haiku scout sweep (no deep audit — run 45 <24h). #404
                                 #   closed the §32 signup-referral audit (#370) by making the never-throw contract
                                 #   testable (DI helper in @gm/core + 8 guard tests); #406 a11y file-input labels (WCAG
                                 #   3.3.2); #407 a §28 Stripe-webhook fail-loud on an unrecognized subscription price
                                 #   (mirrors the #380 captcha / #378 HMAC hardenings). The 2-reviewer gate earned its
                                 #   keep: #404-A's conditional block was resolved by the real source, #407-B surfaced an
                                 #   extra real bypass path. Convergence stays reach-gated (#190, base ≈ $33K < $100K,
                                 #   owner-GTM); did NOT open 'ready'; Confidence stays UNCHECKED. Validation 5/5, 0 unmet.
                                 #   -- prior run 45: converged quiet run + a full 5-lens DEEP AUDIT (due since run 41). 1 real
                                 #   value-bar clear (#390 a11y heading semantics on landing pricing + cook loop, WCAG
                                 #   1.3.1), 0 abandons, both reviewers 2/2 first pass. 2 scout findings correctly
                                 #   REJECTED: the ewmaConsumptionRate "inflation" bug (misreads a deliberate
                                 #   repurchase-cadence model) + the monetization "unbuilt levers" (all speculative/
                                 #   owner-dependent/scope-creep, stacked still below the $100K floor). Security/RLS/
                                 #   Track-G + artifacts re-confirmed CLEAN. Closed #359 (all 3 §28 fixes on main).
                                 #   Convergence stays reach-gated (#190); did NOT open 'ready'; Confidence stays UNCHECKED.
                                 #   -- prior run 44: converged quiet run — 1 real value-bar clear, 0 abandons, 2/2 first pass.
                                 #   #386 added the missing PRECISION/anti-hallucination half of the vision scan eval
                                 #   (it only measured recall; a phantom detection silently pollutes a real user's
                                 #   pantry — the exact failure detect.ts's presence+2D-box design targets), Track F /
                                 #   #319. Full 3-Haiku scout sweep (reliability, security/Track-G, design/a11y+mobile):
                                 #   3 candidates PASSED on judgment, not padding — CSP unsafe-inline/eval removal
                                 #   (needs a nonce migration + real-browser verify; hydration-break risk too high
                                 #   headless), mobile color centralization (18-file cosmetic churn + native BUILDS!=WORKS
                                 #   risk), and 3 server-action raw-throws (scout's "silent data loss/inconsistent state"
                                 #   framing was FALSE — app/error.tsx boundaries + withTenant transactions handle them
                                 #   gracefully; the inline-friendly-error pattern exists only for receipt parse because
                                 #   IT fails often). The run's load-bearing work was git hygiene: a STALE local origin/main
                                 #   (#369, 14 behind) manufactured a phantom "#379 worker-stub reverted" regression —
                                 #   fetch + rebase confirmed no regression. Security/RLS/Track-G re-confirmed CLEAN.
                                 #   Convergence stays reach-gated (#190); did NOT open 'ready'; Confidence stays UNCHECKED.
                                 #   -- prior run 41: converged run + a full 5-lens DEEP AUDIT (due since run 38). 2 real
                                 #   value-bar clears, 0 abandons, both 2/2 first pass. #371 corrected a stale README
                                 #   design-system bullet (dead Inter/Fraunces/aurora/bento/accent-themes/frosted-nav
                                 #   description → the shipped Hanken-Grotesk/single-accent/solid-nav reality; LIVING
                                 #   ARTIFACTS). #372 swapped the last 4 raw-hex #0a6e33 buttons → the byte-exact
                                 #   text-brand-solid-hover token + a WCAG-AA contrast comment at each site (100% TSX
                                 #   token discipline; PERMANENTLY ends the recurring "use brand-solid" mis-flag, which
                                 #   would regress contrast 6.38:1→4.45:1). Deep audit: Security/RLS/Track-G CLEAN (29
                                 #   tables), correctness/functional CLEAN, monetization RE-CONFIRMED reach-gated (the
                                 #   sole buildable lever — a collections add-on — is ~$1-3K/yr + collides with the locked
                                 #   subscription-only v1 decision), perf 3-of-3 rejected (ingest batching = <2% on an
                                 #   LLM-bound path + core-path regression risk), coverage clean. 0 reverts, 0 circuit
                                 #   breaks. The branch-entanglement trap recurred (run-39) but was harmless (pushed
                                 #   commits verified correct + disjoint; tree reset). Convergence stays reach-gated
                                 #   (#190); did NOT open the 'ready' issue; Confidence statement stays UNCHECKED.
                                 #   -- prior (run 35): converged quiet run — 2 real value-bar clears, 0 abandons. #315 raised the
                                 #   cook-mode timer + step-nav buttons to the 44px WCAG/Apple touch-target minimum
                                 #   (+timer aria-labels) on the app's most hands-busy surface; #316 fixed a real
                                 #   money-math bug in computeMrrUsd (per-sub round(3999/12) baked a 0.25¢/sub bias →
                                 #   $1 MRR understatement at 56 annual subs; now amortizes on the aggregate + regression
                                 #   test). The run's value was the FILTER: 5 of 7 scout candidates rejected on
                                 #   verification, TWO would have been active regressions (adding CORS ACAO:* = weaker
                                 #   security; swapping the deliberate #0a6e33 contrast hardcode to the AA-failing
                                 #   brand-solid token). Security/RLS/Track-G CLEAN; mobile IAP loop + vision invariant
                                 #   confirmed intact (2026-06-29 scorecard's ship-critical gaps remain closed). Monetization
                                 #   scout confirmed the honest floor is reach-gated (owner GTM), not lever-gated. 0 reverts,
                                 #   0 circuit breaks. Convergence stays reach-gated (#190) + grade-pending (scorecard STALE,
                                 #   independent re-grade owed). Did NOT open the 'ready' issue.
                                 #   -- prior (run 34): 4 real value-bar clears, 0 abandons — #308 mobile paywall off-brand
                                 #   purple→brand-green (the #1 conversion surface; design bar), #309 dropped the last
                                 #   deprecated grape/berry palette usages in apps/web for brand/danger tokens, #310
                                 #   completed the store premium-feature list (unlimited Discover + spend insights) to
                                 #   match billing/index.ts, #311 unit-covered the DB normalization ports keyless (a real
                                 #   skipIf-gated CI hole on the ingestion cascade). The 2-reviewer gate paid for itself
                                 #   TWICE without a single wasted change: Reviewer A caught a genuine contrast regression
                                 #   introduced by the color swap (#308) AND a false-confidence guard test via mutation
                                 #   testing (#311) — both fixed in a 2nd cycle, both then 2/2. 0 reverts, 0 circuit
                                 #   breaks, duplicate-coverage trap did NOT recur. Convergence stays reach-gated (#190,
                                 #   business-case floor) + grade-pending (the independent Quality Auditor must re-grade —
                                 #   the scorecard (2026-06-29) is STALE: its two named ship-critical B gaps were fixed in
                                 #   PRs #266/#263, and vision now shows ~100% coverage, not the ~0% it cites). Did NOT
                                 #   open the 'ready' issue.
```

## How to read it (owner)
- **`improving`/`steady`** — shipping clears the bar, few abandons/reverts, readiness attempts converge.
- **`churning`** — lots abandoned/reverted vs. shipped → the loop is busy, not better. Check
  `abandoned_reasons` for the pattern.
- **`stuck`** — `recurring_failures` keeps naming the same wall and `harness_proposals_open` is 0 → the META
  channel is dead; raise a `loop: harness improvement proposal`.
- A quiet honest run with a small shipped count + a clean signal is a SUCCESS; a high `changes_shipped` with
  a high abandon/revert rate is NOT.
