# GroceryManager — Quality Memory

Durable memory for the independent Quality Auditor (maker ≠ checker). Read FIRST each run and diff the
new grade against the last entry. Append-only; newest entry on top.

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
