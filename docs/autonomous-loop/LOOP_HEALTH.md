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
  as_of: 2026-07-01 (run 35)
  enforced_in_ci: true           # lint + functional E2E journeys + the capabilities tripwire are REQUIRED checks on main, enforce_admins=true
  validation:                    # capability self-validation feed — refresh every run from `node scripts/check-self-validation.mjs --readiness`
    enforced_in_ci: true         # 'self-validation (capabilities tripwire)' is a required, enforce_admins status check
    capabilities_total: 5
    active: 5
    unmet: []                    # capabilities needing an OWNER SECRET not wired in CI (loop can't supply) — each MUST also be an urgent OWNER_ACTION 'validation-capability-<service>' in PENDING_OPS
    unmet_unsurfaced: []         # MUST stay empty — an unmet capability missing from PENDING_OPS or this list is invisible to the owner (a bug)
  last_run: 2026-07-01 (run 35)
  last_deep_audit: 2026-07-01 (run 35, folded 5-lens scout sweep: security/RLS+Track-G, correctness/tests, design/a11y, living-artifacts, monetization/business-case-strength — no CRITICAL findings, 5 of 7 candidates rejected on verification incl. 2 would-be regressions; runs 33/34 folded prior sweeps; last standalone run 30)
  this_run:
    changes_shipped: 2           # #315 cook-mode 44px touch targets + timer aria-labels (Track F a11y) #316 growth MRR aggregate-amortization money-math fix + regression test — both file-disjoint + this housekeeping PR
    changes_abandoned: 0
    abandoned_reasons: []
    verify_cycle_failures: 0     # both changes passed their local gate first try (typecheck / lint --max-warnings=0 / core test / prod build)
    review_rejections: 0         # both got both reviewers, 2/2 APPROVE first pass (one MRR reviewer mis-read a branch-visibility artifact — the commit was on its own branch, not the checked-out tree — and confirmed APPROVE on the merits once pointed at the commit; not a real rejection)
    review_cycles_used: 1
    circuit_breaker_trips: 0
  rolling_7d:
    merged_prs: 71               # 68 prior + gtm-audit #313 + this run's #315/#316 (+housekeeping in flight)
    reverts: 0
    readiness_attempts: 0
    readiness_rejected: 0
    recurring_failures:          # short bullets: the SAME wall hit across ≥2 runs (→ harness proposal if it persists)
      - "duplicate-coverage trap (runs 32–33): did NOT recur in run 34 — the coverage scout confirmed db-ports.ts is genuinely CI-uncovered by grepping the target FUNCTION NAMES across all *.test.ts (every prior reference mocks the ports), and Reviewer B independently mutation-verified it's new coverage, not a dup. The run-33 LOOP_MEMORY rule worked. Streak broken; no harness proposal needed."
    harness_proposals_open: 0    # open `loop: harness improvement proposal` issues (#232 resolved by #234)
  signal: steady                 # bootstrapping | improving | steady | churning | stuck
                                 #   run 35: converged quiet run — 2 real value-bar clears, 0 abandons. #315 raised the
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
