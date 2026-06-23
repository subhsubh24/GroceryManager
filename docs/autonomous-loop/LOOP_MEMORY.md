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
- **2026-06-23 — Keyword rules need whole-word guards when a substring could match a food.** `matchShelfLifeRule` uses `n.includes(k)` on a space-padded name. A keyword like `"batter"` matches "batteries" (intended) AND "pancake batter" (wrong). Fix: wrap keywords in spaces — `" battery "` / `" batteries "` — so they require whole-word boundaries. When auditing keyword tables, check each keyword against common food terms that share its substring.
- **2026-06-23 — Space-padding both sides does NOT prevent false positives when the keyword is a leading word in a food name.** `"pad "` (trailing space) matched "pad thai" because `" pad thai sauce "` contains `"pad "` at position 1. Switching to `" pad "` (both spaces) ALSO matches because the word boundary still fires: `" pad thai "` starts with `" pad "`. The fix for this class of problem is (a) switch to a more specific longer phrase (`"heating pad"`, `"nursing pad"`), or (b) use the plural form (`" pads "` doesn't match "pad thai" since there's no "s"). Audit: a short keyword that is also the first word of a common dish is the highest-risk pattern in the shelf-life table.
- **2026-06-23 — Range-drop regex must handle unicode fraction high-ends.** `parseMeasure` in `consume.ts` has a range-drop step that strips the high end of ranges like `1-2`, `1/2-3/4`. The old regex `(?:\d+\s+)?\d+(?:[\/\.]\d+)?` missed unicode fractions (`¾`, `1½`) as high-ends, causing the unit to be silently dropped. Fix pattern: add `(?:\d+\s*)?[½⅓⅔¼¾⅛⅜⅝⅞]` as the first alternative before the numeric-only alternative. When any regex handles the low-end of a range via a leading-quantity match, always audit the range-drop for matching high-end coverage.
- **2026-06-23 — Diet-keyword false positives on plant-based compound foods.** `dietExclusions(["vegan"])` returns single-token keywords like `"butter"` and `"milk"`. The token-subset matcher (`{"butter"} ⊆ {"peanut","butter"}`) causes `"peanut butter"` to trigger the butter exclusion, wrongly filtering vegan-safe recipes. Fix: add a separate `dietKeywords` field to `RankPrefs` with a `PLANT_BASED_COMPOUND_TOKENS` allowlist; use token-subset for the allowlist check too so qualified strings like `"2 tbsp peanut butter"` are also exempt. True allergens use the unchanged `allergens` field so peanut-allergy safety is unaffected. Tracking: `use-it-up/page.tsx` currently passes no `prefs` to `rankRecipes`, so diet/allergen filtering is completely absent there — separate fix needed.
- **2026-06-23 — Branch lineages reconciled.** There used to be two diverged lineages
  (`main` and an old `claude/busy-turing-XkEQX`); they were reconciled by promoting the canonical
  content to `main` and deleting the stray branch. There is now ONE lineage: `main`. Always read
  the actual working tree (`git show HEAD:path` / `grep`) before assuming a fix is present, and
  target `main` (the default) for all work.
