# Autonomous self-improving loop — replication checklist (definition of done)

Goal: stand up a fully autonomous, CI-gated, peer-reviewed auto-merge loop on a repo, identical
in behavior to this one. Set up each item, then verify it. The three layers people miss when
copying just the prompt: **(a)** the CI workflow + branch protection + auto-merge (GitHub settings,
not prompt text), **(b)** the `gh workflow` scope dependency, **(c)** the acceptance test that
proves the loop closes end-to-end.

## 0. Preconditions / auth
- [ ] `gh auth status` shows you're logged in with repo admin on this repo.
- [ ] `gh auth refresh -h github.com -s workflow` has been run (needed to push
      `.github/workflows` files). If lacking, the bootstrap opens an issue asking the owner to run
      it, and falls back to self-gated merge meanwhile.
- [ ] Identify the DEFAULT BRANCH: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`

## 1. Detect the stack (reused everywhere)
- [ ] Record the VERIFY COMMANDS that exist (tests, typecheck, lint, build, determinism/repro).
      These are the merge gate.

## 2. Repo anchor + memory files
- [ ] `VISION.md` exists — north star, hard constraints, a DESIGN BAR ("must NOT look
      vibe-coded — use the design system, no ad-hoc styles"), and out-of-scope items.
- [ ] Project rules file exists + honored (AGENTS.md / CLAUDE.md / CONTRIBUTING).
- [ ] Reserved, created lazily by the loop: `IMPROVEMENT_LOG.md` (per-run handoff),
      `docs/autonomous-loop/LOOP_MEMORY.md` (lessons), `PENDING_OPS.md` (migrations/env to apply at deploy).

## 3. CI workflow (`.github/workflows/ci.yml`)
- [ ] Triggers on push to the default branch AND all `pull_request` events.
- [ ] Job named exactly `verify` runs the detected verify commands and is the gate.
- [ ] Optional non-blocking `quality` job (lint+build) with `continue-on-error` for pre-existing debt.
- [ ] VERIFY: push it; `gh run list --workflow CI` shows a run; `verify` concludes `success`.

## 4. GitHub settings (gh api; needs admin)
- [ ] Auto-merge enabled:
      `gh api -X PATCH repos/{owner}/{repo} -F allow_auto_merge=true -F delete_branch_on_merge=true -F allow_squash_merge=true`
- [ ] Branch protection on the default branch requires the `verify` check, NO required human
      reviews, `enforce_admins=false`: `required_status_checks.contexts=["verify"]`, `strict=false`,
      `required_pull_request_reviews=null`, `restrictions=null`. (Set AFTER `verify` has run once.)
- [ ] VERIFY: `gh api repos/{owner}/{repo}/branches/{branch}/protection` shows required `verify`,
      no required reviews.

## 5. The scheduled cloud routine
- [ ] Created via the schedule/routines flow with the FULL self-bootstrapping prompt (see PROMPT.md).
- [ ] Prompt contains ALL of: stack-detection + idempotent bootstrap; BRAKES (one change/run,
      ≤2 reviewers, ≤3 verify + ≤3 review cycles, circuit breaker, spend/blast-radius discipline,
      when-in-doubt-stop); HILL-CLIMB from PR history + memory; ORIENT to VISION/rules + never
      relax guard tests; PICK ONE rotating across areas; IMPLEMENT on a branch; VERIFY gate; TWO
      independent reviewer subagents (maker ≠ checker); CI-gated auto-merge with self-gated
      fallback; PENDING_OPS for migrations/env; IMPROVEMENT_LOG + loop-memory updates; FYI-issue
      (not PR) on failure; Co-Authored-By trailer.
- [ ] Cadence `0 */3 * * *` (every 3h) · Model `claude-sonnet-4-6` · Source = this repo's URL.
- [ ] Allowed tools: Bash, Read, Write, Edit, Glob, Grep, Task (Task is required).

## 6. Spend
- [ ] Structural brakes prevent runaway, but the routine has NO hard dollar cap. Set a usage/spend
      limit in the Anthropic Console for this project — the only true ceiling.

## 7. Acceptance test (prove it closes end-to-end)
- [ ] Trigger one run (or wait for the first scheduled run).
- [ ] Within ~30 min it produces ONE of: an auto-merged PR (CI `verify` green + two reviewer
      approvals) OR an FYI/tracking issue. No PR is left waiting for human review.
- [ ] `IMPROVEMENT_LOG.md` gains an entry; `docs/autonomous-loop/LOOP_MEMORY.md` exists.
- [ ] If a migration/env was involved, `PENDING_OPS.md` lists it.
- [ ] If nothing appears: the cloud `gh` likely lacks repo write or `workflow` scope — confirm
      auth and re-run.
