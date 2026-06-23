# Autonomous self-improving loop

A scheduled **cloud** Claude Code routine that lands one verified, peer-reviewed improvement to
this repo every 3 hours, fully autonomously — CI-gated, two independent reviewer subagents, and
auto-merge. This folder is the canonical, version-controlled source so the setup is reproducible.

- **[PROMPT.md](./PROMPT.md)** — the exact prompt the routine runs. Keep it in sync with the routine.
- **[CHECKLIST.md](./CHECKLIST.md)** — the replication checklist / definition of done (CI workflow,
  branch protection, auto-merge, `gh workflow` scope, and the end-to-end acceptance test).

## How it works (one run)
ORIENT (VISION + rules) → HILL-CLIMB (PR history + memory) → BOOTSTRAP (idempotent: CI / branch
protection / memory files) → PICK ONE (rotating area) → IMPLEMENT on a `claude/*` branch → VERIFY
(the gate) → REVIEW (two subagents, maker ≠ checker) → MERGE (CI-gated auto-merge, self-gated
fallback) → RECORD (IMPROVEMENT_LOG + loop-memory + PENDING_OPS) → STOP. On any failure it leaves
the repo clean and opens an FYI issue instead of a half-finished PR.

## The three things people miss (not in the prompt)
1. **GitHub settings** — auto-merge + branch protection requiring the `verify` check (set via
   `gh api`, needs admin). Without these the loop can't gate or auto-merge.
2. **`gh workflow` scope** — required to push `.github/workflows/*`. If the cloud token lacks it,
   the loop opens an issue asking the owner to run `gh auth refresh -h github.com -s workflow`.
3. **The acceptance test** — prove a run ends in an auto-merged PR or a tracking issue, never a PR
   waiting on a human.

## Spend
The structural brakes prevent runaway loops, but there's no hard dollar cap on the routine. Set a
usage limit in the Anthropic Console — that's the only true ceiling.

## This repo's setup
- Routine cadence: `0 */3 * * *` · model `claude-sonnet-4-6` · tools include `Task`.
- Default (protected) branch: `main`.
- Gate: `pnpm -r run typecheck` · `pnpm -r run test` · production `next build` (+ missing-export grep).
