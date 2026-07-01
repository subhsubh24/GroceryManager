# GroceryManager — Quality Memory

Durable memory for the independent Quality Auditor (maker ≠ checker). Read FIRST each run and diff the
new grade against the last entry. Append-only; newest entry on top.

---

## 2026-07-01 — SHIP GATE NOW MET (overall B → A)

**Overall: A. Ship gate: MET (was NOT met at baseline).** Mechanical gate this run: typecheck PASS,
`@gm/core` tests PASS (92 files pass / 9 skipped; 817 tests pass / 24 skipped; coverage lines 86.42 /
branches 87.24 / functions 89.82 — thresholds met), production `next build` PASS (no missing-export
warnings, 102 kB shared first-load). Graded by 9 fresh adversarial per-dimension subagents, none having
written the code.

**Both baseline ship-critical B's driven to A — the two blockers are fixed and regression-guarded:**
- **launch_readiness B → A.** The mobile IAP stub is gone. `apps/mobile/app/upgrade.tsx:82-103` now has a
  real `onBuy → purchase(pkg) → res.status==="active"` flow; `apps/mobile/lib/purchases.ts:103-113` calls
  real `Purchases.purchasePackage()` + reads `hasPremiumEntitlement`, `restore()` wired (App Store req).
  Degrades without key via `isPurchasesConfigured()`; the inert "coming soon" state survives only in the
  unconfigured branch (mirrors web Stripe). Server-side entitlement: `webhooks/revenuecat/route.ts` fails
  closed (timing-safe), maps GRANT/REVOKE into the same `appendPreferenceSignal` ledger as Stripe. Issue
  #260 resolved → closed this run.
- **correctness_reliability B → A.** (1) `vision/persist.ts` now references `pantryStock` only in a
  `.select()` read; every mutation routes through `appendLedgerAndReproject`, and 5 tests assert
  `db.update` is never called (`persist.unit.test.ts:97-100`) — the ledger-only invariant is tripwired.
  (2) The vision pipeline + `generate-llm` are now genuinely covered (vision 98.84% lines; logCook
  7.97% → 99.27%). Independently re-verified EWMA / spoilage-ceiling / LLM-degrade — no bug found.

**Grades:** functional_reality **A**, correctness_reliability **A** (SC, ↑from B), security **A**,
design_taste **A**, launch_readiness **A** (SC, ↑from B), tests_evals **B**, artifact_integrity **A**
(↑from B — F4 perf-budget tick was retracted, manifest honest), business_case **A**, performance **B**.

**Two non-ship-critical B's remain (both ≥ B, don't block the gate):**
- **tests_evals B** — baseline's two structural gaps (vision + logCook coverage) are CLOSED; the sole
  remaining gap is **no vision-quality eval**: `detect.ts` is only unit-tested with a stubbed client, so
  the flagship "pantry fills itself" scan stage has no LLM-judge on real fixture images. The dimension
  grader assigned "A−"; mapped to **B** (scale has no minus grades, and a missing eval on a flagship LLM
  stage is a real named gap, not a trivial nit — anti-inflation → the lower whole grade). Still ≥ B.
- **performance B** — good hygiene (indexes, no N+1, cheap-first LLM ladder) but **no CI perf-budget
  gate** and a **276 KB uncompressed edge middleware** (next-auth/jose on the edge). The grader caught
  that the apparent middleware 276→88.5 kB "drop" is only Next 15.5 now reporting the *gzipped* size —
  the bundle is unchanged. This is the same standing gap as baseline; held at B.

**Grader-vs-auditor adjustments (transparency):**
- tests_evals: grader said "A−"; the scale has no minus grades. Held at **B** because a missing quality
  eval on a flagship LLM stage is a real, named, non-blocking gap (the B definition), not a trivial nit
  (the A definition). Noted in the scorecard that it is high-B/near-A with baseline gaps closed.
- Several A dims carry a small named nit (RevenueCat event-map unit test; indirect escalate-loop test;
  CSP/CORS tradeoffs) — kept at A because those are second-order nits within their dimension, whereas a
  coverage gap is first-order for tests_evals specifically.

**Issues this run:** closed #260 (launch_readiness, now A); no open correctness quality issue remained
(the baseline one was already closed). Filed/updated non-ship-critical gap issues for tests_evals
(vision eval) and performance (perf-budget gate). #190 (honest revenue FYI) left open — unchanged.

**What "raise to A+" looks like next run:** add the vision-quality eval (closes tests_evals) and a CI
perf-budget gate + edge-middleware trim (closes performance) → overall A+ within reach. Two bounded
A→A+ polish tests on already-A ship-critical dims (RevenueCat event-map, direct escalate-loop) are
optional gold-avoidance.

---

## 2026-06-29 — BASELINE GRADE (first run)

**Overall: B. Ship gate: NOT met.** Bootstrapped `QUALITY_RUBRIC.md` (9 dimensions, 5 ship-critical)
and `QUALITY_SCORECARD.md` from the rubric standard, adapted to this stack (Next 15 PWA + Expo,
Postgres/Drizzle RLS, Gemini cheap-first). Mechanical gate this run: typecheck PASS, `@gm/core` tests
PASS (86 files, vitest thresholds met), production `next build` PASS (no missing-export warnings,
102 kB shared first-load). Graded by 9 fresh adversarial per-dimension subagents, none having written
the code.

Grades: functional_reality **A**, correctness_reliability **B** (SC), security **A**, design_taste
**A**, launch_readiness **B** (SC), tests_evals **B**, artifact_integrity **B**, business_case **A**,
performance **B**.

**Why the ship gate is blocked (two ship-critical B's):**
- **launch_readiness B** — mobile RevenueCat IAP is a disabled "Payments coming soon" stub
  (`apps/mobile/app/upgrade.tsx:71`), no `Purchases.purchasePackage()`. The web Stripe path is fully
  wired; the mobile payment path is not. An App-Store-targeted app that can't accept payment on device
  is not submittable. This is the single hard blocker.
- **correctness_reliability B** — (1) `packages/core/src/vision/persist.ts:110-112` writes
  `pantryStock` directly after `appendLedgerAndReproject`, violating the ledger-only invariant
  (semantically harmless but real); (2) vision ingestion path (detect/persist/resolve) +
  `recipe/generate-llm.ts` ship at ~0% coverage.

**Cross-cutting:** correctness + tests gaps share a root cause — the vision-scan ingestion path is
real shipping logic that is untested and contains the invariant violation. Fixing it closes both.

**Grader-vs-auditor adjustments (transparency):**
- artifact_integrity: the dimension grader proposed B citing two *unchecked* DoD boxes (the quality
  grade box itself + the confidence statement). Those are *correctly* unchecked (good discipline), not
  integrity defects — so that reasoning was set aside. Held at **B** on a *different*, valid finding:
  ROADMAP Track F4 ticks "performance budgets" while the performance audit found no CI budget gate
  exists — a ticked claim without its artifact.
- performance: grader said "B+"; mapped to **B** (scale has no B+). All findings positive except the
  missing CI perf-budget gate and a heavy (~276 KB uncompressed) middleware bundle.

**Issues filed this run:** quality issues for the two ship-critical-below-A dimensions
(launch_readiness, correctness_reliability). No prior quality issues existed (only #190, the honest
revenue FYI). No duplicates.

**What "raise to A" looks like next run:** mobile IAP wired (degrading w/o keys like web); the direct
`pantryStock` write removed + vision/logCook tests added; then re-grade. Non-ship-critical B's
(tests, artifact, performance) are ≥ B and don't block — close them opportunistically.
