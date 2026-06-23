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
- **2026-06-23 — IPv4-mapped IPv6 is a silent SSRF bypass in URL guards.** Node's WHATWG URL parser normalizes `::ffff:127.0.0.1` → `[::ffff:7f00:1]` (all-hex), so text guards checking for `127.` / `10.` / `169.254.` never fire. Always add `host.startsWith("[::ffff:")` alongside the IPv4 range blocks in any SSRF guard.
- **2026-06-23 — Mixed-number + unicode fractions are a recurring blind spot.** All three modules (`cook.ts`, `consume.ts`, `import.ts`) handle the same set of quantity formats, but only `cook.ts`'s `NUM` regex originally had `\d+\s*[½¼…]`. When adding or auditing unicode fraction handling, always check all three modules. The pattern to look for: a character class like `[½⅓⅔¼¾⅛⅜⅝⅞]` used alone without an adjacent `\d+\s*` prefix to handle the mixed-number case.
- **2026-06-23 — Keyword rules need whole-word guards when a substring could match a food.** `matchShelfLifeRule` uses `n.includes(k)` on a space-padded name. A keyword like `"batter"` matches "batteries" (intended) AND "pancake batter" (wrong). Fix: wrap keywords in spaces — `" battery "` / `" batteries "` — so they require whole-word boundaries. When auditing keyword tables, check each keyword against common food terms that share its substring; "pad " (trailing space already) is another example of this pattern in use.
- **2026-06-23 — Branch lineages reconciled.** There used to be two diverged lineages
  (`main` and an old `claude/busy-turing-XkEQX`); they were reconciled by promoting the canonical
  content to `main` and deleting the stray branch. There is now ONE lineage: `main`. Always read
  the actual working tree (`git show HEAD:path` / `grep`) before assuming a fix is present, and
  target `main` (the default) for all work.
