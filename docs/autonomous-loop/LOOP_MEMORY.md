# Loop memory — lessons for the autonomous loop

Durable, cross-run lessons. The loop appends here each run; read it before picking work.
(Intentionally NOT under `.claude/` — see lesson 1.)

## Lessons
- **2026-06-23 — Never edit `.claude/` or `.github/` in an unattended run.** Files under those
  paths are treated as "sensitive" and trigger a permission prompt a headless cron run can't
  answer, which hangs the whole run. Keep loop memory at `docs/autonomous-loop/LOOP_MEMORY.md`
  (here), `IMPROVEMENT_LOG.md` + `PENDING_OPS.md` at repo root, and never recreate/edit the CI
  workflow (it already exists). Set branch protection via `gh api` (a CLI call), never by editing
  workflow files.
- **The gate is `pnpm -r run typecheck` · `pnpm -r run test` · production `next build`** (with the
  missing-export grep). `next build` needs `NODE_ENV=production` + a dummy `DATABASE_URL`.
- **Default branch is `claude/busy-turing-XkEQX`** (protected, requires the `verify` check). Branch
  feature work off it; PRs auto-merge once `verify` is green + both reviewers approve.
- **2026-06-23 — Two lineages exist: `claude/busy-turing-XkEQX` (our default) and `main`.** These
  branches diverged and do not share a common ancestor in this clone. Fixes or features committed
  to `main` (e.g. via PRs targeting main) are NOT automatically on our default branch, and vice
  versa. Always `git show HEAD:path/to/file` or `grep` the actual working tree before assuming a
  fix is present. Never assume a fix from a PR targeting `main` has landed here.
