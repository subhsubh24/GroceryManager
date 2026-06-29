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
  as_of: 2026-06-29 (run 25)
  enforced_in_ci: true           # lint + functional E2E journeys are REQUIRED checks on main, enforce_admins=true
  last_run: 2026-06-29 (run 25)
  last_deep_audit: 2026-06-29 (run 24; folded into scout sweep — within 24h, so run 25 went straight to fan-out)
  this_run:
    changes_shipped: 1           # PR #247 (F4.1 round-trip) — 1 code PR + this housekeeping PR
    changes_abandoned: 0
    abandoned_reasons: []        # [{change, reason}] reason ∈ gate_tsc|gate_test|gate_build|gate_mobile|review_value|review_correctness|circuit_breaker|conflict|dead_end|blocked_owner
    verify_cycle_failures: 0
    review_rejections: 0         # both Sonnet reviewers APPROVED #247 first pass
    circuit_breaker_trips: 0
  rolling_7d:
    merged_prs: 51
    reverts: 0
    readiness_attempts: 0
    readiness_rejected: 0
    recurring_failures: []       # short bullets: the SAME wall hit across ≥2 runs (→ harness proposal)
                                 #   (the CI-gate-enforcement wall #232 was RESOLVED via #234: lint + functional
                                 #   E2E journeys are now REQUIRED status checks on main — META channel worked end-to-end.)
    harness_proposals_open: 0    # open `loop: harness improvement proposal` issues (#232 resolved by #234)
  signal: steady                 # bootstrapping | improving | steady | churning | stuck
                                 #   run 25: 1 real gate (F4.1) closed first-pass (0 abandons/reverts/rejections);
                                 #   2 scouts found 0 other value-bar work → deliberately quiet, coherent. Convergence
                                 #   is reach-gated (#190) + missing QUALITY_SCORECARD, not product/quality churn.
```

## How to read it (owner)
- **`improving`/`steady`** — shipping clears the bar, few abandons/reverts, readiness attempts converge.
- **`churning`** — lots abandoned/reverted vs. shipped → the loop is busy, not better. Check
  `abandoned_reasons` for the pattern.
- **`stuck`** — `recurring_failures` keeps naming the same wall and `harness_proposals_open` is 0 → the META
  channel is dead; raise a `loop: harness improvement proposal`.
- A quiet honest run with a small shipped count + a clean signal is a SUCCESS; a high `changes_shipped` with
  a high abandon/revert rate is NOT.
