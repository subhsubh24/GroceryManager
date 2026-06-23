# VISION — GroceryManager

The north star for every change. Read this first (the autonomous loop does too).

## The north star (why this exists)
This is being built to become a **real, sellable product** — shipped to the **App Store** as a
paid/subscription app that earns **reliable, consistent revenue** as a dependable side income.
Every decision serves that: it must be polished and trustworthy enough that a stranger pays for it
and keeps paying. That means a genuinely useful core loop, a professional bar (never "vibe-coded"),
honest behavior that earns trust, low/degrading run cost (margins matter), and a clean,
monetizable, multi-tenant foundation. "Good" = something people would happily pay for, every month.

## What it is
A personal **grocery + cooking autopilot** PWA (Next.js 15, mobile-first). It ingests
receipts (Gmail + photo), infers a pantry that depletes over time, predicts run-outs,
drafts the shopping list, suggests "cook what I have tonight," tracks cook macros, and
proactively nudges you (web push / SMS) when it's time to order — learning your taste and
cadence as you cook, buy, and waste.

## Who it's for
A busy person who doesn't want to think about groceries or meals. Personal-first, but
**SaaS-ready** (per-user auth, clean multi-tenant boundaries). Aesthetic target audience:
Gen-Z / millennial — it must feel like a polished, trustworthy product, not a demo.

## What "good" looks like
- **The pantry is the core.** It is the always-current log of what's in your home; keep it
  accurate as intelligently and hands-free as possible. Everything else (recipes, list,
  reorder, plan) reads from it.
- **Honest > flashy.** Show real, DB-derived values only — never fake/placeholder data. When
  uncertain, surface the uncertainty (confidence, "needs review") and *ask* rather than assume.
- **Hands-free where confident, ask where ambiguous.** Confident matches/decisions are
  automatic; genuine ambiguity prompts a quick one-tap confirmation.
- **The loop compounds.** Cooking decrements the pantry → sharpens consumption rates →
  improves reorder predictions → builds the list over time.

## Hard constraints (inferable; do not violate)
- **Multi-tenant via RLS.** Every per-user read/write runs inside `withTenant(getDb(), userId, …)`.
- **Pantry is a projection of an append-only ledger.** Never write `pantry_stock` directly — go
  through `appendLedgerAndReproject` / `reprojectStock`.
- **LLM is cheap-first + best-effort.** Use the cheapest tier that passes verification; any LLM
  call that can fail must `try/catch` and degrade — never block the user. Rules for
  money-/safety-adjacent or hot-path decisions; LLM for fuzzy world-knowledge tasks.
- **Everything degrades.** Missing key (Gemini / Instacart / Twilio / VAPID / FDC) → the feature
  no-ops gracefully; nothing breaks.
- **The gate is the verifier.** `pnpm -r run typecheck` · `pnpm -r run test` · production
  `next build` (with the missing-export grep). Keep it green; never relax a test to pass it.

## The DESIGN BAR (must NOT look vibe-coded)
- Use the project's design system only: the tokens + component classes in
  `apps/web/app/globals.css` and `apps/web/tailwind.config.ts`. **No ad-hoc inline styles, no
  rainbow/AI-flourish, no template-y look.**
- One typeface (Hanken Grotesk), a single garden-green accent used sparingly + mostly solid,
  generous whitespace, calm motion, dark-mode aware, iPhone-aware (safe areas, 16px inputs,
  visible focus rings). Icons via the lucide registry (`components/icons.tsx`) — never emoji.
- Formatting is presentable: `titleCase` / `humanize` (no raw slugs/enums in the UI).

## Out of scope (don't build)
Social feed, recipe-authoring CMS, full calorie/macro *tracking* app, bank/Plaid sync, anything
that makes the app feel like a generic dashboard. Truly tap-free ordering (ToS-violating browser
automation of consumer Instacart/Amazon accounts) stays out of the core.
