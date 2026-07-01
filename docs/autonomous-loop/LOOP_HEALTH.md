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
  as_of: 2026-07-01 (run 33)
  enforced_in_ci: true           # lint + functional E2E journeys + the capabilities tripwire are REQUIRED checks on main, enforce_admins=true
  validation:                    # capability self-validation feed — refresh every run from `node scripts/check-self-validation.mjs --readiness`
    enforced_in_ci: true         # 'self-validation (capabilities tripwire)' is a required, enforce_admins status check
    capabilities_total: 5
    active: 5
    unmet: []                    # capabilities needing an OWNER SECRET not wired in CI (loop can't supply) — each MUST also be an urgent OWNER_ACTION 'validation-capability-<service>' in PENDING_OPS
    unmet_unsurfaced: []         # MUST stay empty — an unmet capability missing from PENDING_OPS or this list is invisible to the owner (a bug)
  last_run: 2026-07-01 (run 33)
  last_deep_audit: 2026-07-01 (run 33, folded into the scout sweep — 5 lenses across security/RLS+abuse, functional/design, artifact-freshness, tests, monetization; last standalone run 30)
  this_run:
    changes_shipped: 3           # #304 LLM-fallback tests (capture-parse + shelf-life-llm) #305 scan-error-hygiene (G3) #306 README test-count fix + this housekeeping PR
    changes_abandoned: 1         # a fresh growth/experiments math test suite (stats+bucketing+lift) — REPEAT of run 32's dead-end
    abandoned_reasons: [review_value]
    verify_cycle_failures: 0     # all 3 shipped changes passed their local gate (typecheck + core tests + web build) first try
    review_rejections: 1         # 1 of 4 candidates rejected: Reviewer B (value) found the growth/experiments tests duplicated experiments.test.ts (already covers assignVariant/z-test/Wilson/minSampleSize incl. the zFromAlpha regression). Reviewer A had APPROVED — split verdict → abandoned per the both-approve rule. The other 3 got 2/2 APPROVE first pass.
    review_cycles_used: 1        # no shipped change needed a 2nd review cycle
    circuit_breaker_trips: 0
  rolling_7d:
    merged_prs: 64               # ~61 prior + this run's #304/#305/#306 (+housekeeping in flight)
    reverts: 0
    readiness_attempts: 0
    readiness_rejected: 0
    recurring_failures:          # short bullets: the SAME wall hit across ≥2 runs (→ harness proposal if it persists)
      - "duplicate-coverage trap: runs 32 AND 33 each abandoned a growth/experiments math test suite already covered by the aggregate experiments.test.ts. A scouting-diligence miss (adjacent-file grep didn't see the aggregate test file), not yet a harness-level wall — recorded as a specific LOOP_MEMORY line for the next run. Escalate to a harness proposal only if it recurs a 3rd time."
    harness_proposals_open: 0    # open `loop: harness improvement proposal` issues (#232 resolved by #234)
  signal: steady                 # bootstrapping | improving | steady | churning | stuck
                                 #   run 33: 3 real value-bar clears on already-complete tracks — #304 covered two
                                 #   genuinely-untested best-effort LLM fallbacks (capture parse + shelf-life-llm,
                                 #   both confirmed uncovered by the reviewers), #305 closed the last raw-e.message
                                 #   leak in the scan action (G3, mirroring #295), #306 fixed README test-count drift
                                 #   (330→780+). 1 abandon (review_value) — the 2-reviewer gate correctly caught a
                                 #   growth/experiments test suite duplicating experiments.test.ts, a REPEAT of run
                                 #   32's dead-end (scouting missed the aggregate test file). 0 reverts, 0 circuit
                                 #   breaks. NOT churning: 3 shipped / 1 abandoned, all shipped changes clean 2/2.
                                 #   Convergence stays reach-gated (#190, business-case floor) + grade-pending (the
                                 #   independent Quality Auditor must re-grade — the scorecard's two named ship-critical
                                 #   B gaps, mobile IAP + vision ledger write, were fixed in PRs #266/#263). Did NOT
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
