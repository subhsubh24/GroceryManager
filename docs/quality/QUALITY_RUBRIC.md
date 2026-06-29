# GroceryManager — Quality Rubric (A+ → F)

> Owned by the **independent Quality Auditor** routine (maker ≠ checker). The factory loop CONSUMES
> the grade in `QUALITY_SCORECARD.md`; it never authors or overwrites these quality docs. Every grade
> must be backed by a **mechanical signal the grader actually ran** plus **file/line evidence**. A
> grade may NOT exceed what the mechanical signals support. A bare letter is rejected; below-A must
> name the SPECIFIC actionable gap.

## Product context (the bar this product must clear)

GroceryManager is a **paid, subscription, multi-tenant** grocery + cooking autopilot — a Next.js 15
PWA (`apps/web`) plus a native Expo app (`apps/mobile`), aimed at the App Store / Google Play. The
taste bar is set by `VISION.md` (the DESIGN BAR — "would an experienced product designer intentionally
make this decision?", no AI-slop) and the ship target by `ROADMAP.md` (store-acceptable with high
confidence; revenue floor ≥ $100K/yr is the FLOOR not the target). "Good" = a stranger would happily
pay every month.

## Grade scale (per dimension)

- **A+** — exemplary: all mechanical signals green + zero findings + clears the taste/quality bar with room to spare.
- **A** — world-class, trivial nits only. **This is the ship bar.**
- **B** — solid with a real, named, non-blocking gap.
- **C** — works but notable gaps; below the ship bar.
- **D** — significant problems.
- **F** — broken / unsafe / absent. A ticked box with no real artifact is an **F**.

## Dimensions

| # | Dimension | Ship-critical | What it measures | Primary mechanical signal |
|---|-----------|:---:|------------------|---------------------------|
| 1 | **functional_reality** | ✅ | Real user journeys work end to end: signup → working main screen; core list → cook → buy loop; ingestion → pantry → reorder. | Build green; route/page inventory wired to real server actions/queries; e2e journey spec; manual trace of each flow's handler. |
| 2 | **correctness_reliability** | ✅ | Logic is correct under edge cases; ledger/projection invariants hold; LLM calls degrade, never block; everything fails soft on missing keys. | `pnpm -r run typecheck`; `pnpm --filter @gm/core test`; inspection of degrade paths + ledger reprojection. |
| 3 | **security** | ✅ | Server-side auth/entitlement on every data surface; RLS via `withTenant`; no client trust; rate limits; CORS/headers; secrets safe; webhook sig verification. | Per-route tenant/auth audit; `next.config` headers; rate-limit coverage; secret scan; cron auth. |
| 4 | **design_taste** | ✅ | Clears the VISION DESIGN BAR: intentional, hand-crafted, not generic-AI-slop. a11y (WCAG). No fake data. | e2e screenshots; a11y attributes audit; component/token inspection; design-system consistency. |
| 5 | **launch_readiness** | ✅ | Everything shipping this product needs: store assets/listing, privacy/terms, data-safety, account deletion, billing wired, build/deploy config, native release config. | Build green; store-asset + privacy/terms artifacts present & real; Stripe/entitlement code; eas.json/app.config. |
| 6 | **tests_evals** | ⬜ (≥ B) | Real test + eval coverage of the logic that matters; coverage floor enforced; evals exist for LLM stages. | Test run + coverage table vs thresholds; eval suite presence; per-stage eval coverage. |
| 7 | **artifact_integrity** | ⬜ (≥ B) | Every ticked DoD/ROADMAP box is backed by a real artifact; docs match code; no contradictions. | Spot-check ticked boxes against code; docs-vs-code consistency (pricing, routes, flows). |
| 8 | **business_case** | ⬜ (≥ B) | Honest path to the revenue floor; high-ROI levers BUILT not just listed; no gamed numbers. | `docs/BUSINESS_CASE.md` math vs code-sourced prices; growth-engine code presence; honesty of floor claim. |
| 9 | **performance** | ⬜ (≥ B) | Reasonable bundle/query/render perf; perf budgets; DB indexes; no obvious N+1 / unbounded work. | Build output sizes; perf-budget config; index migrations; hot-path inspection. |

## Ship gate

`ship_gate_met = true` **only when every ship-critical dimension (1–5) is A or A+** AND every other
dimension is ≥ B (or has a named, justified reason). Drive-to-A+ is **bounded**: name only
value-bar-clearing improvements; no gold-plating.

## How this auditor grades each run

1. ORIENT — read this rubric, the last `QUALITY_SCORECARD.md`, `QUALITY_MEMORY.md` (diff vs last grade), `VISION.md`/`README.md` (taste bar), `ROADMAP.md` (DoD + ship-critical).
2. GRADE — spawn one fresh, adversarial grader subagent per dimension (none having written the code); each runs a mechanical signal and cites file/line evidence.
3. WRITE — update the machine-readable block in `QUALITY_SCORECARD.md` (valid YAML), append to `QUALITY_MEMORY.md`, commit a file-disjoint PR touching ONLY these quality docs, auto-merge through the gate.
4. FILE — open/update a GitHub issue for each top gap (especially any ship-critical dim below A).
5. REPORT — concise grade report to the owner; then STOP.
