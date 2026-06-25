# Pending Ops

Migrations, env-var additions, or infra changes that need to be applied at deploy time.
The autonomous loop appends here when a code change requires a manual step at deploy.

---

## 2026-06-25 — Wire lint + E2E as CI checks (Track F, PRs #122 + #125)

Two new quality gates are ready but not yet in the CI workflow:

1. **Add lint step to CI** (`pnpm --filter web lint`). Currently `apps/web/eslint.config.mjs`
   enforces zero warnings locally, but CI only runs `typecheck + test + build`. A lint failure
   won't block a PR. To activate: add `pnpm --filter web lint` to the `verify` job in
   `.github/workflows/ci.yml` (after typecheck, before build).
   > NOTE: `.github/workflows/` files cannot be edited by the autonomous loop (requires a human
   > with `workflow` scope). See CHECKLIST.md §0 for auth setup.

2. **Wire E2E tests as a non-blocking CI job**. `apps/web/e2e/smoke.spec.ts` + `playwright.config.ts`
   are merged. Running them requires a live Next.js server + `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`.
   Suggested CI job:
   ```yaml
   e2e:
     needs: verify
     runs-on: ubuntu-latest
     continue-on-error: true  # non-blocking until stabilized
     steps:
       - uses: actions/checkout@v4
       - run: pnpm install
       - run: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers BASE_URL=http://localhost:3000 pnpm --filter @gm/web e2e &
       - run: NODE_ENV=production DATABASE_URL=... pnpm --filter web start &
   ```
   Requires: `DATABASE_URL` secret in GitHub Actions + server-start synchronization (use `wait-on`).

**Status:** Code merged. Human Core required — editing `.github/workflows/ci.yml` needs `workflow` scope.

---

## 2026-06-24 — Waitlist DB migration + admin email (Track E, PR #106)

Migration 0012 creates the `waitlist_submissions` table. The waitlist form on the landing page
now writes to this table (and `/admin/waitlist` reads from it). To activate:

1. **Apply migration 0012** (`waitlist_submissions` table + unique email index):
   ```bash
   pnpm --filter @gm/db db:migrate
   ```
   Idempotent; safe to run multiple times. Requires `DIRECT_DATABASE_URL` (Supabase direct connection).

2. **Set `ADMIN_EMAIL`** in Vercel env (the email address you use to sign in to GroceryManager):
   ```
   ADMIN_EMAIL=you@example.com
   ```
   Without this, `/admin/waitlist` redirects to `/signin` for all users (logged in the server error log).
   With it set, only the matching account can access the admin area.

3. **Verify:** Submit the waitlist form on the landing page → check `/admin/waitlist` shows count = 1.

**Status:** Code merged (PR #106). Human Core required for steps 1–2 above.

---

## 2026-06-24 — Push notification migration + EAS project ID (Track B, PRs #97 + #98)

The push notification infrastructure is fully wired in code. To activate:

1. **Apply migration 0011** (creates `push_tokens` table + RLS policy):
   ```bash
   pnpm --filter @gm/db db:migrate
   ```
   Idempotent; safe to run multiple times.

2. **Set `EXPO_PUBLIC_PROJECT_ID`** in the Expo/EAS env (`.env` for local dev;
   EAS secrets for builds):
   - Get the project ID from the EAS dashboard after creating the project:
     `npx eas project:info` (in `apps/mobile/`)
   - Set it: `EXPO_PUBLIC_PROJECT_ID=<your-eas-project-id>`
   - Without this value, `registerForPushNotifications` is a no-op — the rest of
     the app is unaffected.

3. **Rebuild the native app** after setting the env var (the value is baked into
   the JS bundle at build time via `EXPO_PUBLIC_*` convention).

**Status:** Code merged (PRs #97 + #98). Human Core required for steps 1–3 above.

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
`submitWaitlistEmail` in `apps/web/app/components/waitlist-action.ts`. As of PR #106 this action
persists the email to the `waitlist_submissions` DB table (apply migration 0012 above first).

To also trigger a drip email sequence, wire the action to a real email service:

1. **Sign up for ConvertKit / Mailchimp / Loops / similar** (owner picks service).
2. **Add the API key to env** (e.g. `CONVERTKIT_API_KEY` or `LOOPS_API_KEY`) — never committed.
3. **Add an email-service SDK call** in `waitlist-action.ts` after the `insertWaitlistEmail` line:
   ```ts
   await emailService.subscribe({ email, listId: process.env.EMAIL_LIST_ID });
   ```
4. **Wire the 15-email lifecycle** from `docs/brand/EMAIL_LIFECYCLE.md` into your chosen provider.
5. **Test** with a real submission to confirm delivery + DB persistence before launch.

**Status:** DB persistence wired (PR #106). Human Core required for email service account + key.

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

---

## Store icon PNG export — DONE (PR #112, 2026-06-25)

All PNG artifacts are now committed. No owner action required for icons.

- `apps/web/public/icons/icon-1024.png` — 36K, RGB opaque (no alpha), Apple App Store + EAS
- `apps/web/public/icons/icon-512.png` — 16K, RGB opaque, Google Play
- `apps/web/public/icons/icon-192.png` — 8K, RGB opaque, PWA
- `apps/mobile/assets/icon.png` — 36K, RGB opaque, EAS main icon (`app.json "icon"` field added)
- `apps/mobile/assets/adaptive-icon.png` — 24K, RGBA transparent foreground (Android adaptive system applies background `#0c8a3e` from `app.json`)
- `docs/store/assets/feature-graphic.png` — 24K, Google Play feature graphic (1024×500, brand-green)
- `manifest.webmanifest` — updated with PNG entries (Safari PWA compatibility)

Generated by `scripts/generate-store-assets.mjs` (Playwright/Chromium, CI runner).
To regenerate locally: install playwright, update paths in the script.

**Remaining owner action:** Upload `icon-1024.png` to App Store Connect and Google Play Console.
