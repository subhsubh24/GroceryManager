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
  as_of: 2026-06-30 (run 31)
  enforced_in_ci: true           # lint + functional E2E journeys + the capabilities tripwire are REQUIRED checks on main, enforce_admins=true
  validation:                    # capability self-validation feed — refresh every run from `node scripts/check-self-validation.mjs --readiness`
    enforced_in_ci: true         # 'self-validation (capabilities tripwire)' is a required, enforce_admins status check
    capabilities_total: 5
    active: 5
    unmet: []                    # capabilities needing an OWNER SECRET not wired in CI (loop can't supply) — each MUST also be an urgent OWNER_ACTION 'validation-capability-<service>' in PENDING_OPS
    unmet_unsurfaced: []         # MUST stay empty — an unmet capability missing from PENDING_OPS or this list is invisible to the owner (a bug)
  last_run: 2026-06-30 (run 31)
  last_deep_audit: 2026-06-30 (run 30; folded into scout sweep — within 24h, so run 31 went straight to fan-out)
  this_run:
    changes_shipped: 5           # #288 paywall #289 add #290 waste #291 persist-polish #292 stats-sign-fix + this housekeeping PR
    changes_abandoned: 1
    abandoned_reasons: [{change: "stats.ts coverage test (claude/test-growth-stats)", reason: review_value}]  # Reviewer B: ~10 assertions duplicated existing experiments.test.ts coverage — net-new cases too marginal to keep; abandoned rather than churn a trimmed re-review
    verify_cycle_failures: 0
    review_rejections: 1         # the abandoned stats-coverage change (Reviewer B value REQUEST_CHANGES). All 5 shipped PRs APPROVED by both reviewers first pass; 3 Reviewer-A polish notes (add/waste/persist) applied pre-merge.
    review_cycles_used: 1        # no shipped change needed a 2nd cycle this run
    circuit_breaker_trips: 0
  rolling_7d:
    merged_prs: 56               # 53 squash-merges in the 7d window (git log) + #291/#292/housekeeping in flight this run
    reverts: 0
    readiness_attempts: 0
    readiness_rejected: 0
    recurring_failures: []       # short bullets: the SAME wall hit across ≥2 runs (→ harness proposal)
                                 #   (the CI-gate-enforcement wall #232 was RESOLVED via #234: lint + functional
                                 #   E2E journeys are now REQUIRED status checks on main — META channel worked end-to-end.)
    harness_proposals_open: 0    # open `loop: harness improvement proposal` issues (#232 resolved by #234)
  signal: steady                 # bootstrapping | improving | steady | churning | stuck
                                 #   run 31: 5 real value-bar clears (3 CI silent-green coverage holes on core
                                 #   orchestration — pantry persist / waste-persist / capture add — + a context-aware
                                 #   paywall conversion lever + a REAL prod bug a reviewer surfaced: the zFromAlpha
                                 #   sign error under-sizing A/B experiments ~10x). 1 abandon (stats coverage test:
                                 #   Reviewer B found it duplicated existing experiments.test.ts — value-bar reject,
                                 #   NOT churned into a trimmed re-review). 0 reverts. The abandon is the system
                                 #   working: maker != checker caught duplication, and the SAME change's Reviewer A
                                 #   incidentally found the production sign bug → turned a rejected test into a fix.
                                 #   Convergence stays reach-gated (#190) + grade-pending (Quality Auditor re-grade).
```

## How to read it (owner)
- **`improving`/`steady`** — shipping clears the bar, few abandons/reverts, readiness attempts converge.
- **`churning`** — lots abandoned/reverted vs. shipped → the loop is busy, not better. Check
  `abandoned_reasons` for the pattern.
- **`stuck`** — `recurring_failures` keeps naming the same wall and `harness_proposals_open` is 0 → the META
  channel is dead; raise a `loop: harness improvement proposal`.
- A quiet honest run with a small shipped count + a clean signal is a SUCCESS; a high `changes_shipped` with
  a high abandon/revert rate is NOT.
