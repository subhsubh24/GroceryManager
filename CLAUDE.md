# GroceryManager — agent guide

A personal grocery + cooking autopilot PWA. Ingests receipts (Gmail + photo), infers a pantry that
depletes over time, predicts run-outs, suggests meals, and tracks cook macros. Mobile-first.

## Stack & layout

- **pnpm + Turborepo monorepo**, TypeScript end-to-end, Node ≥ 20.11, `pnpm@9.12.0`.
- `apps/web` — Next.js 15 (App Router) + React 19 PWA (UI + server actions + API routes).
- `packages/core` — all business logic (ingestion, pantry/depletion, reorder, recipe, nutrition,
  vision, personalization, llm, capture). Framework-agnostic. Subpath exports per module
  (`@gm/core/pantry`, `@gm/core/recipe/log-cook`, …) — see `packages/core/package.json` "exports".
- `packages/db` — Drizzle schema, queries, migrations. `packages/config` — zod env + constants.
  `packages/shared` — shared zod/types. `services/workers` — BullMQ + one-off backfill scripts.
- Dependency rule: `apps/*` and `services/*` depend on `packages/*`; `packages/*` never on `apps/*`.
  `packages/db` must NOT import `packages/core` (would cycle).

## The gate — run before every commit (this is the verifier; trust it, keep it green)

```bash
pnpm -r run typecheck
pnpm --filter @gm/core test          # ~408 tests; pure logic, no DB/LLM needed
NODE_ENV=production DATABASE_URL=postgres://u:p@localhost:5432/db pnpm --filter web build
```

- **`next build` REQUIRES `NODE_ENV=production`.** With `NODE_ENV=development` it fails with a bogus
  `<Html> should not be imported outside of pages/_document` during /404 generation. CI sets production.
- After a build, grep the log for `Attempted import|is not exported from|was not found` — `next build`
  exits 0 even on broken re-exports because pages are `force-dynamic` (not prerendered). CI does this.
- CI (`.github/workflows/ci.yml`): `verify` (typecheck + test + build, fails on missing-export
  warnings) + `migrate` (runs the full migration chain on a throwaway `pgvector/pgvector:pg16`).

## Run locally

```bash
pnpm install
pnpm --filter @gm/db db:migrate                        # idempotent; needs DATABASE_URL (+ DIRECT_DATABASE_URL)
pnpm --filter @gm/workers backfill:embeddings          # semantic matching (needs GEMINI_API_KEY)
pnpm --filter @gm/workers backfill:shelf-life          # classify + age existing items
pnpm --filter web dev
```

Env (`.env` at repo root): `DATABASE_URL` required; everything else optional and degrades —
`GEMINI_API_KEY` (LLM; free tier can't parse receipts, needs billing), `FDC_API_KEY` (macros),
`GOOGLE_CLIENT_ID/SECRET` (Gmail). See `packages/config/src/env.ts`.

## Conventions (do these; the app depends on them)

- **No fake data in the UI.** Render real DB-derived values only; show empty/quiet states otherwise.
- **Multi-tenant via RLS.** Every per-user read/write runs inside `withTenant(getDb(), userId, tx => …)`;
  `currentUserId()` (from `@/app/lib/tenant`) resolves the session. Admin/provisioning uses `getAdminDb()`.
- **Pantry is a projection of an append-only ledger.** Never write `pantry_stock` directly — go through
  `appendLedgerAndReproject` (or `removePantryItem`/`clearPantry`). `reprojectStock` learns the EWMA
  consumption rate + applies the shelf-life spoilage ceiling, aged to `now`.
- **New canonical items get shelf-life + domain** via `estimateShelfLife(name)` in `createCanonical`,
  which is **idempotent on slug** (reuse on conflict — same product → one canonical, quantities accrue).
- **LLM is cheap-first + best-effort.** `GeminiClient.generateWithVerify` (flash-lite → flash → pro,
  verify-then-escalate). Any LLM call that can fail must `try/catch` and degrade — never block the user
  (receipt parse, macros, capture, meal-gen all do this).
- **Display formatting:** never show raw slugs/lowercase. Use `titleCase` (item names) + `humanize`
  (enums like `personal_care` → "Personal Care") from `@/app/lib/format`. `timeAgo` for dates.
- **Auth:** username + password (credentials); email is optional, set when Gmail connects. Re-login
  every launch (LaunchGuard). Do NOT call `auth()`/`cookies()` in the root layout (breaks static /404).
- **Migrations** are hand-written idempotent SQL in `packages/db/sql/000N_*.sql`, wired into
  `migrate.ts` in order. Use `ADD COLUMN IF NOT EXISTS`, etc.
- **lucide-react is pinned to `0.460.0`** — do NOT use `latest`/`^1.x` (the 1.x line is the ancient
  2020 release; npm's `latest` wrongly points at it and it lacks modern icon names). Add icons via
  `apps/web/app/components/icons.tsx` (the registry) — never emoji.
- **Self-validate every capability — never merge what CI can't prove.** The `self-validation (capabilities
  tripwire)` CI check (required, `enforce_admins`) runs `scripts/check-self-validation.mjs` against the
  manifest `packages/config/capabilities.json`. When you add/extend a capability, REGISTER it there with how
  it's proven **keyless** in CI: an `e2e` spec the e2e job actually runs (`specs`), or a unit/degrade test
  (`tests`) — plus any non-secret CI env it needs (`requiresCiEnv`, e.g. `EMAIL_CAPTURE_DIR`). If a capability
  can ONLY be validated with a key the loop can't supply (an external sandbox secret), set `requiresOwnerSecret`
  + `ownerActionId` AND surface an `OWNER_ACTION` (`blocks: validation`) in `PENDING_OPS.md` — the tripwire then
  goes RED until the owner wires the secret in CI, so the PR can't merge. NEVER ship a capability behind an
  env-gated `test.skip` without declaring its env in the manifest (the checker rejects undeclared skips — that's
  the silent-green hole). Degrade-by-default is the norm here (LLM/captcha/SMS/Stripe no-op without keys), so most
  capabilities are keyless-validatable; prefer a degrade test over needing an owner secret.

## How to work here (the loop)

1. Plan the slice. 2. Implement. 3. **Run the gate** (above) and fix until green. 4. Commit + push.
   For bigger slices, delegate the build to a subagent, then review the diff + run the gate yourself
   before committing (the writer doesn't grade its own homework).
- Each bug fix should leave a test behind (e.g. `coercePurchasedAt`, `estimateShelfLife`, nutrition).
- Branch: `claude/<name>`. Don't open a PR unless asked.

## Docs

`docs/PLAN.md` (full product/architecture plan), `docs/ROADMAP.md` (loop memory),
`docs/AI_ENGINEERING.md`, `docs/GMAIL_SETUP.md`.
