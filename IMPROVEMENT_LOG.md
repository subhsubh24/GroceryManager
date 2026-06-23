# Improvement Log

Dated entries from each autonomous loop run.

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
