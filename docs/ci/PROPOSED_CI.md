# CI gate + auto-migrate — staged config (GroceryManager)

> **Status: LIVE on GroceryManager.** Both parts below are already applied (PRs #234 + #236) and the
> gate jobs are **required status checks** on `main`. This doc is the canonical record of *what's wired*
> and the **cross-factory reference template** (HighlightMagic / JobScraper / AptDesignerAI adapt it to
> their stack; LLM-Quant uses its reproduce-deterministically gate, no UI journeys).
>
> The loop CANNOT edit `.github/` (it hangs a headless run). On a repo where this isn't applied yet, the
> loop STAGES this doc + raises a `loop: harness improvement proposal`; a **workflow-scope human** applies
> the workflow + secrets + branch protection, **after verifying the gate is green** (never make a flaky/red
> check required — it would block auto-merge).

The live config is in `.github/workflows/ci.yml`. Reproduced here for review + as the template.

---

## Part A — quality gate as a REQUIRED check (no build-but-broken / lint-dirty auto-merge)

**Product prerequisites (built, through the normal gate):** the outcome-asserting, self-seeding
functional journey suite (`apps/web/e2e/journeys.spec.ts`: signup → working dashboard, never an error
screen; the core-product output actually renders) + the route inventory (`apps/web/e2e/ROUTE_INVENTORY.md`)
+ lint-at-zero (`apps/web` eslint `--max-warnings=0`).

**Two gotchas baked in so the first CI run is green** (these were real failures on the first run):
1. **Trusted host / base URL** — next-auth v5 refuses an "untrusted" localhost host, so the credentials
   sign-in callback can't redirect → signup hangs. Set `AUTH_TRUST_HOST=true` + `AUTH_URL` +
   `NEXTAUTH_URL=http://localhost:3000` on the gate job. (Supabase-auth stacks: set
   `NEXT_PUBLIC_SITE_URL` / `PLAYWRIGHT_BASE_URL` equivalently.)
2. **Rate-limit bypass (TEST-ONLY)** — the self-seeding suite signs up many accounts from one CI runner
   IP and trips the 5/hour signup limiter. `apps/web/app/api/_lib/rate-limit.ts` has an explicit bypass
   gated on `RATE_LIMIT_DISABLED === "1"` — an env var **production NEVER sets** — and the gate job sets
   `RATE_LIMIT_DISABLED: "1"`. (Suggested generic name elsewhere: `E2E_RATE_LIMIT_BYPASS`; GM uses
   `RATE_LIMIT_DISABLED`.)

**Jobs (live):**
- `lint (web, zero warnings)` — install → `pnpm --filter @gm/web lint`.
- `e2e functional journeys (BUILDS != WORKS)` — pgvector Postgres service → install → migrate fresh DB →
  install Playwright Chromium → `next build` → `next start` + wait → `pnpm --filter @gm/web e2e journeys`
  (`BASE_URL=http://localhost:3000`) → upload screenshots/traces artifact.

**Branch-protection required checks (live on `main`):**
`verify`, `mobile`, `migrations (fresh db)`, `lint (web, zero warnings)`, `e2e functional journeys (BUILDS != WORKS)`.

---

## Part B — auto-migrate on deploy (migrations stop being a manual `db push`)

**Job (live):** `migrate-prod` — runs `pnpm --filter @gm/db exec tsx src/migrate.ts` (forward-only,
idempotent; NEVER resets), **only** `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`
and **only** `needs: [verify, migrate]` (so it runs after the build is green AND the full chain is
validated against a fresh throwaway DB — a bad migration never reaches prod). Serialized via
`concurrency: migrate-prod`. Gated on the `PROD_DIRECT_DATABASE_URL` secret → **warns + skips** until set.

**Safety rails (why auto-applying to prod is safe here):**
- Migrations still pass the **2-reviewer + RLS/security review** BEFORE merge (the normal PR gate).
- The job is **default-branch + post-gate only** and **forward-only** (no reset/down).
- **Recoverability net FIRST:** enable Supabase **PITR** (or daily backups) BEFORE relying on this —
  it's the net the manual checkpoint used to provide.
- **Tradeoff (apply consciously):** this removes the *human schema checkpoint* — a migration that passes
  CI + review now reaches prod with no manual pause. The fresh-DB validation + review + PITR are the
  replacement safety; that's the deliberate trade for zero recurring `db push` work.

---

## Owner one-time steps (then it's hands-off forever)
1. **Apply the workflow** — done (GroceryManager; needs `workflow` scope).
2. **Mark required** — done (branch protection, after verifying green).
3. **`PROD_DIRECT_DATABASE_URL`** GitHub Actions secret (the Supabase owner/direct connection — same value
   as Vercel's `DIRECT_DATABASE_URL`) → enables `migrate-prod`. See `PENDING_OPS` `enable-auto-migrate-secret`.
4. **Enable Supabase PITR / daily backups** BEFORE enabling auto-migrate. See `PENDING_OPS` `enable-db-pitr-backups`.

Never put a real secret in a commit or an issue.
