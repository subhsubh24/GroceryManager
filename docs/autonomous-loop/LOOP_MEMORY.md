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
- **Default branch is `main`** (protected, requires the `verify` check). Branch
  feature work off it; PRs auto-merge once `verify` is green + both reviewers approve.
- **2026-06-23 — Check sister modules for consistency before declaring a bug fixed.** The unicode
  fraction bug in `cook.ts` only showed up because `consume.ts` already had the correct wider set.
  When a module handles something correctly, grep for analogous code in related modules that might
  have drifted — `parseMeasure` vs `scaleMeasure`/`parseQtyToken` was the canonical example.
- **2026-06-23 — Branch lineages reconciled.** There used to be two diverged lineages
  (`main` and an old `claude/busy-turing-XkEQX`); they were reconciled by promoting the canonical
  content to `main` and deleting the stray branch. There is now ONE lineage: `main`. Always read
  the actual working tree (`git show HEAD:path` / `grep`) before assuming a fix is present, and
  target `main` (the default) for all work.
