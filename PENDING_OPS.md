# Pending Ops

Migrations, env-var additions, or infra changes that need to be applied at deploy time.
The autonomous loop appends here when a code change requires a manual step at deploy.

The machine-readable `OWNER_ACTIONS` block below is the **dashboard-readable** list of things that
need the human owner (the factory + Growth Agent keep it in sync; the prose entries further down are
the detail). Same contract as `BUSINESS_CASE_SUMMARY` / `GROWTH_STATUS`: **valid, parseable YAML, real
items only.** `status` is `open` | `in_progress` | `done`; `priority` is `urgent` | `high` | `normal`.
The dashboard surfaces every `open` item, urgent first.

```yaml
OWNER_ACTIONS:
  project: GroceryManager
  as_of: 2026-06-27
  items:
    - id: spend-caps
      title: Set HARD daily API spend caps + alerts in every provider dashboard
      priority: urgent
      status: open
      why: If the app is live and calls any paid API, an abuse spike or runaway loop can run up cost. A spend cap is the only hard backstop (Track G7).
      how: Google Cloud / Vertex Budgets; Twilio usage triggers; Stripe Radar; Anthropic Console spend limit. Regenerate any key that has been exposed.
      blocks: launch-safety
    - id: connect-channels
      title: Connect + authorize marketing channels to switch the Growth Agent into execute mode
      priority: high
      status: open
      why: The Growth Agent stays in honest "prepare only" mode until you connect your own authorized channels (social API token, email provider, analytics). No execution happens without this.
      how: Connect your own accounts/keys to the deployed app's growth settings (server-side). The agent's daily report lists the exact keys it needs. NEVER hands the agent live secrets — the deployed app sends.
      blocks: growth-execution
    - id: rotate-envl-secrets
      title: Confirm .envl secrets are safe (GitHub push protection blocked a commit containing them)
      priority: high
      status: open
      why: A local .envl held a real GCP API key + Google OAuth client id/secret and was almost committed; GitHub push protection blocked it so it was NOT published. It is now gitignored. Rotate as a precaution if it was ever pushed/shared elsewhere.
      how: Keep .envl local-only (now in .gitignore). If in any doubt, rotate the GCP key + Google OAuth secret and update Vercel env. Verify no secret ever landed on origin.
      blocks: launch-safety
    - id: ci-workflow-scope
      title: Add lint + E2E steps to CI (requires `workflow` scope — human only)
      priority: normal
      status: open
      why: The autonomous loop cannot edit .github/workflows/. Lint + E2E are merged but not wired into CI.
      how: Add `pnpm --filter web lint` and the E2E job to .github/workflows/ci.yml (see prose entry below).
      blocks: none
    - id: waitlist-migration
      title: Apply waitlist migration 0012 + set ADMIN_EMAIL
      priority: normal
      status: open
      why: The in-app waitlist analytics (`/admin/waitlist`, the Growth Agent's real signup source) needs the table + admin email.
      how: "Run `pnpm --filter @gm/db db:migrate`; set ADMIN_EMAIL in Vercel env (see prose entry below)."
      blocks: growth-analytics
    - id: turnstile-keys
      title: Create Cloudflare Turnstile site + set CLOUDFLARE_TURNSTILE_SECRET_KEY + NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY
      priority: high
      status: open
      why: The Turnstile captcha scaffold is wired server-side (waitlist + signup), but it fail-opens when the key is absent. Without the keys set, bot protection is not active in production.
      how: "Create site at dash.cloudflare.com → Turnstile. Set both env vars in Vercel. Add the Turnstile widget <script> to the waitlist form and signup page (copy the client-side snippet from Cloudflare docs)."
      blocks: launch-safety
    - id: llm-quota-redis-upgrade
      title: Upgrade in-memory rate limiter + LLM quota to Redis (Upstash) for multi-instance
      priority: normal
      status: open
      why: Current rate limiter + LLM quota use Node.js in-memory Maps — correct per-instance but not shared across multiple Vercel regions/instances. For single-instance deployments this is sufficient; for global Vercel this needs Redis.
      how: "Install @upstash/ratelimit + @upstash/redis; set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in Vercel env. Replace the Map-based buckets in _lib/rate-limit.ts and _lib/llm-quota.ts with Upstash Ratelimit."
      blocks: multi-instance-safety
```

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

Code is merged and ready (PRs #142 #143). Stripe SDK installed, checkout session creation and
Customer Portal wired, webhook signature verification live. To go live, the owner must:

1. **Create Stripe account** → create Products + Prices:
   - "GroceryManager Premium Monthly" — $4.99/mo recurring, 7-day free trial
   - "GroceryManager Premium Annual" — $39.99/yr recurring, 7-day free trial
   - "GroceryManager Family" — $9.99/mo or $79.99/yr recurring, 7-day free trial (up to 5 members)
2. **Set env vars in Vercel** (never committed):
   - `STRIPE_SECRET_KEY` — `sk_live_…` (or `sk_test_…` for staging)
   - `STRIPE_WEBHOOK_SECRET` — `whsec_…` from Stripe Dashboard → Webhooks → signing secret
     (point the webhook at `https://yourapp.com/api/webhooks/stripe`)
   - `STRIPE_PRICE_MONTHLY` — `price_…` for the $4.99/mo product
   - `STRIPE_PRICE_ANNUAL` — `price_…` for the $39.99/yr product
   - `STRIPE_PRICE_FAMILY` — `price_…` for the $9.99/mo Family plan (up to 5 members)
3. **Set `FEATURE_BILLING=1`** in Vercel env once keys are verified.
4. **(Mobile, later)** Create RevenueCat account → create products → set `REVENUECAT_API_KEY`.

**Factory-complete (no owner action needed):**
- ✅ Stripe SDK (`stripe@^22.3.0`) installed in `apps/web`
- ✅ `POST /api/stripe/checkout` — creates Checkout Session with trial_period_days, userId metadata
- ✅ `POST /api/stripe/portal` — creates Customer Portal session from stored stripe_customer_id
- ✅ `apps/web/app/api/webhooks/stripe/route.ts` — real `constructEvent` SDK verification (fail-closed when STRIPE_WEBHOOK_SECRET set)
- ✅ stripe_customer_id stored in preference ledger on subscription.created/updated
- ✅ Family tier defined in `@gm/core/billing` (billing/index.ts)

**Status:** Code merged (PRs #142 #143). Human Core required for steps 1–4 above.

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

## 2026-06-26 — URGENT (Track G7): set HARD daily API spend caps + alerts (owner-only; the loop cannot)
A live app that calls paid APIs is a wallet-drain target. The loop builds a code-level per-user/day
ceiling (G7), but the real backstop is the provider dashboard. Set these IMMEDIATELY if the app is live:
1. **Gemini / Google Vertex** (Google Cloud Console → Billing → Budgets & alerts): set a HARD monthly
   cap + alerts at 50% and 90% of cap. (Also consider per-API quotas in API & Services → Quotas.)
2. **Twilio** (Console → Billing): set a balance/usage trigger + 50% alert; disable auto-recharge or cap it.
3. **Stripe**: not a spend risk (you receive money), but enable Radar + the fraud rules.
4. **Anthropic Console**: the spend cap on the factory routine itself (separate from app APIs).
Verify: trigger a 50%-of-cap test alert and confirm it arrives. If a key is ever suspected exposed,
regenerate it immediately in the provider dashboard and rotate the env var.
