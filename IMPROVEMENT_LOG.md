# Improvement Log

Dated entries from each autonomous loop run.

---

## 2026-06-23 — fix(shelf-life): "batter" keyword misclassified food as household

**What:** In `packages/core/src/pantry/shelf-life.ts`, the household rule contained the keyword
`"batter"` — a truncated form of "batteries". Because `matchShelfLifeRule` checks `n.includes(k)`
on a space-padded name, it matched both "batteries" (the intended household item) AND food items
like "pancake batter" and "cake batter mix" (grocery items). Those food items were classified as
`domain: "household", perishability: "shelf_stable"` — no spoilage ceiling, appearing in the
wrong vertical.

**Fix:** Replaced `"batter"` with `" battery "` and `" batteries "` (space-wrapped) in the
household rule keywords. The space wrapping requires the word to appear as a whole token in the
padded name, so "battery" / "batteries" still match but "batter" (food) no longer does. This
follows the existing `"pad "` convention in the same file.

**Why:** A perishable food classified as shelf-stable never triggers spoilage warnings and doesn't
age out of the pantry, causing stale "in stock" signals and wrong reorder timing.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/12

**Gate:** typecheck ✓ · 435 core tests ✓ · next build ✓ · no missing-export warnings ✓

**Reviews:** Reviewer A (correctness & safety) APPROVE · Reviewer B (quality & fit) APPROVE

---

## 2026-06-23 — fix(recipe): parseMeasure and cleanIngredientName miss mixed-number unicode fractions

**What:** Two related parsing bugs in `packages/core/src/recipe/`:
- `parseMeasure` in `consume.ts`: "1½ cups flour" parsed as `{ qty: 1, unit: null }` instead of
  `{ qty: 1.5, unit: "cup" }` — pantry decrement fell through to `usedUnmeasured`.
- `cleanIngredientName` in `import.ts`: "1½ tsp salt" → `"½ tsp salt"` instead of `"salt"` —
  ingredient name couldn't match the pantry or shopping list.

Both modules handled bare unicode fractions ("½ cup") and slash fractions ("1 1/2 cups") but not
mixed-number + unicode combinations ("1½", "1 ½").

**Fix:** Added `\d+\s*[½⅓⅔¼¾⅛⅜⅝⅞]` to the `parseMeasure` regex, the `qtyToken` helper, and
`LEADING_QTY` in import.ts. `cook.ts`'s `NUM` regex already had this form — now all three modules
are consistent. 6 new golden assertions (no-space and spaced variants for both modules).

**Why:** `1½ tsp` is common in recipes (baking, sauces). Silent parse failure means either a missed
ingredient match on import or a lost pantry decrement on cook — both degrade the core loop silently.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/11

**Gate:** typecheck ✓ · 434 core tests ✓ · next build ✓ · no missing-export warnings ✓

**Reviews:** Reviewer A (correctness) APPROVE · Reviewer B (quality) APPROVE (cycle 2)

---

## 2026-06-23 — fix(cook): scaleMeasure silently skips ⅛ ⅜ ⅝ ⅞ unicode fractions

**What:** `parseMeasure` in `consume.ts` already handled all 9 common unicode fractions,
but `cook.ts` (`scaleMeasure` / `parseQtyToken` / `NUM` regex / `formatQty`) only knew 5
(½ ¼ ¾ ⅓ ⅔). Measures like "⅛ tsp" fell through silently — Cook Mode recipe scaling
produced `"⅛ tsp × 2"` → `"⅛ tsp"` (unchanged) instead of `"¼ tsp"`.

**Fix:** Added ⅛ ⅜ ⅝ ⅞ to four sites in `cook.ts`: `UNICODE_FRAC` dict, `NUM` character
class (×2), `parseQtyToken` mixed-number regex, and `formatQty` common-fractions table.
Added 6 golden assertions (all 4 new fractions + a mixed-number case).

**Why:** `⅛ tsp` is very common in recipes (salt, baking powder, spices). Silent pass-through
on scaling is confusing to the user and a correctness defect in Cook Mode.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/9

**Gate:** typecheck ✓ · 433 core tests ✓ · next build ✓ · no missing-export warnings ✓

**Reviews:** Reviewer A (correctness) APPROVE · Reviewer B (quality) APPROVE

---

## 2026-06-23 — fix(import): isPublicHttpUrl misses IPv4-mapped IPv6 SSRF bypass

**What:** `isPublicHttpUrl` in `packages/core/src/recipe/import.ts` blocked standard private
IPv4 ranges (`127.x`, `10.x`, `192.168.x`, `169.254.x`, `172.16-31.x`) but not their
IPv4-mapped IPv6 equivalents. Node's URL parser normalizes `http://[::ffff:127.0.0.1]/`
to hostname `[::ffff:7f00:1]` — a form that never matched the existing regex checks —
so the function incorrectly returned `true`, allowing a server-side `fetch()` to reach
loopback, private, and cloud-metadata endpoints via the recipe URL import feature.

**Fix:** Added `host.startsWith("[::ffff:")` after the existing IPv6 loopback guard.
Blocks the entire `::ffff::/96` prefix (all IPv4-mapped addresses). Three golden assertions
added: loopback, private class-A, and cloud-metadata IMDS (169.254.169.254).

**Why:** SSRF on the recipe-import fetch path is a real risk. The bypass was straightforward:
any URL like `http://[::ffff:127.0.0.1]/` would pass the guard and cause the server to
fetch from its own loopback interface.

**PR:** https://github.com/subhsubh24/GroceryManager/pull/10

**Gate:** typecheck ✓ · 434 core tests ✓ · next build ✓ · no missing-export warnings ✓

**Reviews:** Reviewer A (correctness & safety) APPROVE · Reviewer B (quality & fit) APPROVE

---

## 2026-06-23 — fix(consume): parseMeasure drops unit on fractional high-end ranges

**What:** One-line regex fix in `parseMeasure` (`packages/core/src/recipe/consume.ts`).
The range-drop step (`/^[-–—]\s*\d+(?:\.\d+)?\s*/`) only matched integer/decimal
high-ends, so `"1/2 - 3/4 cup"` returned `{unit: null}` — causing the cook→pantry
consumption path to silently fall through to `usedUnmeasured` (no precise decrement)
instead of correctly decrementing by 0.5 cups.

**Fix:** Extended regex to `(?:\d+\s+)?\d+(?:[\/\.]\d+)?` so it also handles
fractional (`3/4`) and mixed-number (`2 1/4`) high-ends. Three new golden assertions.

**Why:** Silent under-decrement on fractional-range measures means the pantry stays
artificially full after cooking, degrading reorder predictions over time.

**Gate:** typecheck ✓ · 432 core tests ✓ · next build ✓ · no missing-export warnings ✓

**Reviews:** Reviewer A (correctness) APPROVE · Reviewer B (quality) APPROVE
