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
packages/core       # engines: ingestion · pantry · reorder · recipe · agent · units · llm · personalization
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
Phase 0 (scaffold) in progress — see the phased roadmap in `docs/PLAN.md` §10.
