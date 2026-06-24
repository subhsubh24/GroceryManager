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

---

## Waitlist email capture — wire to email service before store launch

The landing page waitlist form (`apps/web/app/components/waitlist-form.tsx`) calls the server action
`submitWaitlistEmail` in `apps/web/app/components/waitlist-action.ts`, which currently only logs to
stdout (`console.log`). Before the App Store launch, wire this to a real email service:

1. **Sign up for ConvertKit / Mailchimp / Loops / similar** (owner picks service).
2. **Add the API key to env** (e.g. `CONVERTKIT_API_KEY` or `LOOPS_API_KEY`) — never committed.
3. **Replace the `console.log` in `waitlist-action.ts`** with the SDK call:
   ```ts
   await emailService.subscribe({ email, listId: process.env.EMAIL_LIST_ID });
   ```
4. **Test with a real submission** to confirm delivery before launch.

**Status:** Code merged (PR #47). Human Core required for email service account + key.

---

## Analytics (Plausible) — activate before store launch

Privacy-first analytics are scaffolded in `apps/web/app/layout.tsx` — the Plausible script loads
only when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set.

To go live:
1. **Create a Plausible account** at https://plausible.io (or self-host).
2. **Add your domain** in the Plausible dashboard.
3. **Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`** in Vercel env (e.g. `grocerymanager.app` — no `https://`).
4. **Verify tracking** by visiting the site and checking the Plausible real-time view.

**Goals to configure in Plausible:**
- `Signup` — track the `/signup` page visit
- `Waitlist` — track the waitlist form submission (custom event, wire if needed)
- `Upgrade` — track the `/upgrade` page visit
- `Purchase` — wire from the Stripe webhook response

**Status:** Code merged. Human Core required for Plausible account + domain setup.
