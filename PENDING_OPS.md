# Pending Ops

Migrations, env-var additions, or infra changes that need to be applied at deploy time.
The autonomous loop appends here when a code change requires a manual step at deploy.

---

## 2026-06-24 — Stripe + RevenueCat billing keys (Track C monetization)

Code is merged and ready (`packages/core/src/billing`, `apps/web/app/api/webhooks/stripe/route.ts`,
`/manage-subscription`). To go live, the owner must:

1. **Create Stripe account** → create Products + Prices for $4.99/mo and $39.99/yr.
2. **Set env vars in Vercel** (never committed):
   - `STRIPE_SECRET_KEY` — `sk_live_…` or `sk_test_…`
   - `STRIPE_WEBHOOK_SECRET` — `whsec_…` from Stripe Dashboard → Webhooks → signing secret
   - `STRIPE_PRICE_MONTHLY` — `price_…` for the $4.99/mo product
   - `STRIPE_PRICE_ANNUAL` — `price_…` for the $39.99/yr product
3. **Install the Stripe SDK** in `apps/web`: `pnpm --filter web add stripe`
4. **Uncomment `constructEvent` block** in `apps/web/app/api/webhooks/stripe/route.ts` (the block
   is there as a comment starting at line 36 — remove the failing guard at line 45–51 and activate
   the SDK verification block above it).
5. **Set `FEATURE_BILLING=1`** in Vercel env once keys are verified and checkout is wired.
6. **(Mobile, later)** Create RevenueCat account → create products → set `REVENUECAT_API_KEY`.

**Status:** Code merged. Human Core required before any billing is live.

---

## 2026-06-23 — 0010_rls_catalog.sql (RLS on shared catalog tables)

Enables RLS + a permissive `grocery_app` policy on the six shared catalog tables
(`units_of_measure`, `canonical_items`, `products`, `recipes`, `recipe_ingredients`,
`item_unit_conversions`) to close the Supabase Security Advisor "RLS Disabled in Public"
errors (anon/authenticated could read+write the shared catalog via PostgREST).

**Status: ALREADY APPLIED to the production Supabase DB on 2026-06-23 (via MCP `apply_migration`).**
The migration is idempotent, so the next `pnpm --filter @gm/db db:migrate` run is a safe no-op
that simply brings other environments in sync. No further action required for prod.
