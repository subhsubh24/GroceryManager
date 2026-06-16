# GroceryManager

> Never stress about groceries or cooking. A personal grocery + recipe autopilot that
> learns what you have, predicts run-outs, builds the order, and suggests meals you can
> actually cook with what's on hand — plus a second vertical for household & personal-care
> replenishment.

**The full architecture and roadmap live in [`docs/PLAN.md`](./docs/PLAN.md).** Read that first.

## What it does (flagships)
1. **A pantry that fills itself** from your email receipts (Amazon / Whole Foods / Instacart).
2. **"You're about to run out of X"** reorder nudges → one-tap order.
3. **"Cook what I have tonight"** recipes that respect what's expiring, your diet, *and* your energy/cleanup tolerance.
4. **A weekly autopilot** that plans dinners + drafts the order — across groceries (Instacart) and household/personal-care (Amazon).

## Tech (cost-first, harness-driven)
- **TypeScript** everywhere, **Next.js 15 PWA** (Vercel), **Postgres + Drizzle** (+ `pgvector`, `pg_trgm`).
- **Google Gemini** via `@google/genai` on a cheap-first ladder (`gemini-2.5-flash-lite` → `flash` → `pro`)
  made reliable by a semantic layer + context/loop/harness engineering (verify-then-escalate).
- **BullMQ + Redis** workers for the ingestion backbone.

## Monorepo layout
```
apps/web            # Next.js 15 PWA (UI + BFF)
packages/core       # engines: ingestion · pantry · reorder · recipe · agent · vision · units · llm · personalization
packages/db         # Drizzle schema + migrations + seed
packages/shared     # shared Zod schemas + types
packages/config     # env + constants
services/workers    # BullMQ processors + cron
services/amazon-mcp # optional, opt-in Playwright order-history scraper
```

## Getting started (dev)
```bash
pnpm install
cp .env.example .env        # fill in keys
docker compose -f infra/docker-compose.yml up -d   # Postgres + Redis (see infra/)
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev
```

## Status
A working vertical slice runs end-to-end: pages are server-rendered against Postgres with
**row-level-security** enforcement, and the Gemini-backed features below were verified against the
real model. **227 core unit tests + full workspace typecheck + `next build` green**, plus a gated
**LLM eval harness** (golden fixtures + scorers + LLM-as-judge) that passes live against Gemini.

**Deterministic math never rides on token prediction:** unit conversion, totals reconciliation,
depletion, spend, and dosage are pure, tested TypeScript; and receipt extraction runs the **Gemini
code-execution tool** so prices→cents and totals are computed by executed Python (verified: 3/3 evals
at the cheapest tier, no regression).

**Built & tested**
- **Pantry & depletion** — ledger-projected stock, confidence decay, expiring-soon.
- **Reorder** — run-out prediction (purchase cadence **or declared dosage**), staples autopilot, **par auto-tuning** (buy less of what you waste), draft orders.
- **Replenishment verticals** — groceries → Instacart; **household, personal-care & supplements** → Amazon (keyless Add-to-Cart). **Supplements** get **dosage-based depletion** (bottle size ÷ daily dose → accurate run-out from the first bottle, before any cadence exists).
- **Recipes** — "cook what I have" match/rank, effort + **batch-cook** awareness, **diet/guest** filtering, Cook Mode (timers / wake-lock / scaling) + **substitutions**.
- **Recipe import** — paste a URL/text *or snap a photo* → schema.org JSON-LD first (free), else Gemini (vision for photos) → pantry-matched + **add-missing-to-list** + straight into Cook Mode.
- **Plan-my-week agent** — generator/evaluator over curated candidates (Flash → Pro), deterministic fallback floor.
- **Vision pantry scan** — Gemini-vision detect → reconcile (presence strong, **absence ≠ depletion**).
- **Ingestion** — receipt → extraction → full §5.4 normalization cascade (trigram → **embedding** semantic match via gemini-embedding-001 → **LLM tiebreak**); idempotent. **Gmail → pantry** runs from the app (Connect Gmail → Sync receipts now) *or* the background worker.
- **Personalization** — onboarding interview + always-learning preference ledger → UserModel.
- **Spend / Grocery Wrapped / Waste hub / weekly Digest** — analytics + the Sunday briefing.
- **One-cart ordering** — due staples + your active list merged into one cart, with a **keyless** path (copy-list + per-item Instacart search + Amazon Add-to-Cart); the official one-tap Instacart prefill drops in when a key is set.
- **Web push** — service worker + subscription store + send; the digest cron pushes the weekly briefing / run-out nudges (never on a quiet week). Add VAPID keys to send.
- **Eval harness (the ratchet, §8.5/§12)** — golden fixtures + deterministic scorers + LLM-as-judge gating receipt extraction & recipe import on pass-rate ≥ 0.8 and tracking tier-escalation. Run with `RUN_EVALS=1 … pnpm --filter @gm/core eval`. (It already caught + fixed an over-strict verifier that was forcing costly Pro escalation on fee/tax receipts.)

**Built; needs real infra/keys to exercise** — real-time Gmail push (watch-renew + Pub/Sub webhook +
Vercel-cron route are built; just add a Pub/Sub topic — manual "Sync receipts now" + poll already work
with just OAuth, see `docs/GMAIL_SETUP.md`), web push (built; add **VAPID keys** to deliver),
Instacart's *official* prefilled-list page + affiliate attribution (an optional upgrade over the
keyless ordering path above). The §5.4 semantic-match stage is wired + calibrated (gemini-embedding-001,
L2-normalized, threshold tuned against live pairs) — run `pnpm --filter @gm/workers backfill:embeddings`
to populate the catalog vectors and it activates.

See the phased roadmap in `docs/PLAN.md` §10.
