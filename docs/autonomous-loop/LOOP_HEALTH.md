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
  as_of: 2026-06-30 (run 30)
  enforced_in_ci: true           # lint + functional E2E journeys + the capabilities tripwire are REQUIRED checks on main, enforce_admins=true
  validation:                    # capability self-validation feed — refresh every run from `node scripts/check-self-validation.mjs --readiness`
    enforced_in_ci: true         # 'self-validation (capabilities tripwire)' is a required, enforce_admins status check
    capabilities_total: 5
    active: 5
    unmet: []                    # capabilities needing an OWNER SECRET not wired in CI (loop can't supply) — each MUST also be an urgent OWNER_ACTION 'validation-capability-<service>' in PENDING_OPS
    unmet_unsurfaced: []         # MUST stay empty — an unmet capability missing from PENDING_OPS or this list is invisible to the owner (a bug)
  last_run: 2026-06-30 (run 30)
  last_deep_audit: 2026-06-30 (run 29; folded into scout sweep — within 24h, so run 30 went straight to fan-out)
  this_run:
    changes_shipped: 5           # #282 #283 #284 #285 #286 — 5 code PRs + this housekeeping PR
    changes_abandoned: 0
    abandoned_reasons: []        # [{change, reason}] reason ∈ gate_tsc|gate_test|gate_build|gate_mobile|review_value|review_correctness|circuit_breaker|conflict|dead_end|blocked_owner
    verify_cycle_failures: 0
    review_rejections: 2         # #284 + #286 each got 1 Reviewer-A REQUEST_CHANGES on cycle 1; a FRESH Reviewer A APPROVED both on cycle 2 after addressing/clarifying. The other 3 PRs APPROVED first pass.
    review_cycles_used: 2        # #284/#286 used the 2nd of the ≤2 allowed cycles; #282/#283/#285 closed in 1
    circuit_breaker_trips: 0
  rolling_7d:
    merged_prs: 58
    reverts: 0
    readiness_attempts: 0
    readiness_rejected: 0
    recurring_failures: []       # short bullets: the SAME wall hit across ≥2 runs (→ harness proposal)
                                 #   (the CI-gate-enforcement wall #232 was RESOLVED via #234: lint + functional
                                 #   E2E journeys are now REQUIRED status checks on main — META channel worked end-to-end.)
    harness_proposals_open: 0    # open `loop: harness improvement proposal` issues (#232 resolved by #234)
  signal: steady                 # bootstrapping | improving | steady | churning | stuck
                                 #   run 30: 5 real value-bar clears (the 2 named ship-critical coverage gaps +
                                 #   a latent paywall bypass + a11y + reliability), 0 abandons/reverts. 2 of 5 took a
                                 #   2nd review cycle (1 design-model misread, 1 over-indexed mock-purity nit) — both
                                 #   resolved within the cap, gate held (maker != certifier). Convergence stays
                                 #   reach-gated (#190) + grade-pending (Quality Auditor re-grade), not churn.
```

## How to read it (owner)
- **`improving`/`steady`** — shipping clears the bar, few abandons/reverts, readiness attempts converge.
- **`churning`** — lots abandoned/reverted vs. shipped → the loop is busy, not better. Check
  `abandoned_reasons` for the pattern.
- **`stuck`** — `recurring_failures` keeps naming the same wall and `harness_proposals_open` is 0 → the META
  channel is dead; raise a `loop: harness improvement proposal`.
- A quiet honest run with a small shipped count + a clean signal is a SUCCESS; a high `changes_shipped` with
  a high abandon/revert rate is NOT.
