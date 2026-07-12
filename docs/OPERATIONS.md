# GroceryManager — Operator Runbook

This document is for the person running GroceryManager in production. It covers deployment,
key rotation, database maintenance, monitoring, and common operational tasks.

---

## 1. Architecture overview

| Layer | Technology | Where it runs |
|---|---|---|
| Web app | Next.js 15 (App Router) | Vercel (recommended) |
| Database | PostgreSQL 16 + pgvector | Supabase (recommended) |
| Auth | NextAuth.js (credentials) | Inside the web app |
| LLM | Google Gemini (flash-lite / flash / pro) | Via Gemini API (GEMINI_API_KEY) |
| Email | Optional — ConvertKit / Mailchimp / Loops | Owner-connected (see PENDING_OPS.md) |
| Analytics | Plausible (optional, privacy-first) | Plausible.io or self-hosted |
| Push notifications | Expo Push Notification Service | Via EAS (Expo Application Services) |
| Native app | Expo (React Native) | App Store / Google Play |
| Background jobs | BullMQ workers | `services/workers/` (optional self-host) |

---

## 2. Required environment variables

Set these in your Vercel project settings (never commit to the repo):

### Required

| Variable | Description | Where to get it |
|---|---|---|
| `DATABASE_URL` | Full Postgres connection string (pooled) | Supabase Dashboard → Connect → Connection string (pooled) |
| `DIRECT_DATABASE_URL` | Direct Postgres URL (for migrations) | Supabase Dashboard → Connect → Connection string (direct) |
| `NEXTAUTH_SECRET` | Random 32+ char string for session tokens | `openssl rand -base64 32` |
| `AUTH_SECRET` | Secret for mobile JWT signing | `openssl rand -base64 32` |

### Optional (features degrade gracefully when absent)

| Variable | Feature it enables | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Receipt parsing, meal gen, fridge scan | Free tier insufficient for receipts — needs billing enabled |
| `GOOGLE_CLIENT_ID` | Gmail OAuth for receipt import | Google Cloud Console → OAuth 2.0 Credentials |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth for receipt import | Same as above |
| `FDC_API_KEY` | Nutrition macro estimates | USDA FoodData Central API key (free) |
| `STRIPE_SECRET_KEY` | Billing (Stripe) | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Billing webhook verification | Stripe Dashboard → Webhooks → signing secret |
| `STRIPE_PRICE_MONTHLY` | Monthly plan ($4.99/mo) price ID | Stripe Dashboard → Products → Price ID |
| `STRIPE_PRICE_ANNUAL` | Annual plan ($39.99/yr) price ID | Stripe Dashboard → Products → Price ID |
| `FEATURE_BILLING` | Enable billing UI + paywall | Set to `1` once Stripe keys are verified |
| `FEATURE_HOUSEHOLDS` | Enable household sharing | Set to `1` to activate |
| `REVENUECAT_API_KEY` | Mobile in-app purchases | RevenueCat Dashboard |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Privacy-first analytics | Your domain without `https://` |
| `EXPO_PUBLIC_PROJECT_ID` | Expo push notifications | EAS Dashboard after project creation |
| `NEXTAUTH_URL` | Full public URL of your deployment | `https://your-domain.com` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web push notifications | Generate with `web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Web push notifications (server) | Same command as above |
| `MARGIN_INGEST_KEY` | Cost-per-outcome telemetry (Gemini spend + plan outcomes → Margin) | Issued by the Margin owner; fail-safe no-op when unset |
| `MARGIN_INGEST_URL` | Margin ingest endpoint override | Optional; defaults to Margin's hosted endpoint |

---

## 3. Running database migrations

Migrations are idempotent SQL files in `packages/db/sql/00NN_*.sql`.
**Always run on DIRECT_DATABASE_URL** (not the pooled connection):

```bash
# Apply all pending migrations
pnpm --filter @gm/db db:migrate
```

Safe to run multiple times — each file checks `IF NOT EXISTS` or equivalent.

### Migration history

| File | What it does |
|---|---|
| `0001_schema.sql` | Core tables: users, canonical_items, pantry_stock, recipes, etc. |
| `0002_rls.sql` | Row-Level Security: grocery_app role + app_current_user_id() GUC |
| `0003_household.sql` | Household sharing: households, household_members, shared lists |
| `0004_billing.sql` | Subscription/billing: subscription_tier on users |
| `0005_push_tokens.sql` | Expo push notification tokens |
| `0006_*.sql` | (check sql/ directory for latest) |
| `0010_rls_catalog.sql` | RLS on shared catalog tables (closes Supabase anon exposure) |
| `0011_push_tokens.sql` | push_tokens table + RLS policy |

---

## 4. Deploying to Vercel

### First deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (from repo root)
vercel --prod

# Set env vars (do this before the first deploy or via Vercel dashboard)
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
# ... repeat for each required variable
```

### Subsequent deploys

Push to `main` — Vercel auto-deploys from the default branch.

### After a major change

1. Check that all migrations ran: `pnpm --filter @gm/db db:migrate`
2. Verify the build locally: `NODE_ENV=production DATABASE_URL=... pnpm --filter @gm/web build`
3. Grep the build log for `Attempted import|is not exported from|was not found`

---

## 5. Monitoring + alerting

### What to watch

| Signal | Where to look | Action |
|---|---|---|
| Build failures | Vercel → Deployments → Failed | Read the build log; fix the code |
| DB connection errors | Vercel logs (server-side) | Check Supabase connection pool limits |
| LLM errors | Vercel logs (search "GeminiClient") | Check GEMINI_API_KEY + billing enabled |
| High spend | Gemini Console → Billing | Add a cost alert; reduce to flash-lite |
| Auth errors | Vercel logs (search "NEXTAUTH") | Check NEXTAUTH_SECRET + NEXTAUTH_URL |
| Stripe webhook failures | Stripe Dashboard → Webhooks → Recent events | Check STRIPE_WEBHOOK_SECRET |

### Plausible analytics (if configured)

Visit `https://plausible.io/your-domain` to see:
- Active users + signup funnel
- Upgrade page visits
- Waitlist form submissions (custom event)

---

## 6. Key rotation

### NextAuth session secret (`NEXTAUTH_SECRET`)

Rotating this invalidates ALL active sessions (all users must re-login):
1. Generate new secret: `openssl rand -base64 32`
2. Set in Vercel: `vercel env rm NEXTAUTH_SECRET production && vercel env add NEXTAUTH_SECRET production`
3. Redeploy: `vercel --prod`
4. All existing sessions become invalid immediately.

### Mobile JWT secret (`AUTH_SECRET`)

Rotating this invalidates ALL mobile sessions:
1. Same process as above for `AUTH_SECRET`
2. All mobile users will be signed out and must re-login

### Stripe keys

If a Stripe key is compromised:
1. Revoke in Stripe Dashboard → Developers → API keys → Revoke
2. Create a new key immediately
3. Update in Vercel env + redeploy
4. Update `STRIPE_WEBHOOK_SECRET` if the webhook endpoint changes

### Gemini API key

1. Revoke in Google Cloud Console → Credentials
2. Create a new key
3. Update `GEMINI_API_KEY` in Vercel + redeploy

---

## 7. Common operational tasks

### Adding a new user manually

Users self-register via `/signup`. There is no admin user creation path — by design (multi-tenant via RLS).

### Deleting a user account

Users delete their own account at `/profile` → Danger Zone → Delete account.
This triggers `deleteUserAndAllData` which cascades all rows via `ON DELETE CASCADE`.

If you need to delete a user account from the server side (e.g., GDPR request):
```sql
-- Run via Supabase SQL Editor with the DIRECT connection
-- ALWAYS verify the userId before running
DELETE FROM users WHERE id = 'uuid-here';
-- ON DELETE CASCADE removes all associated data automatically
```

### Viewing and managing waitlist emails

Waitlist submissions are logged to server-side stdout (Vercel logs). Until an email service is
connected (see PENDING_OPS.md), retrieve them from:
- Vercel Dashboard → Deployment → Functions → Runtime Logs
- Filter: `[waitlist]`

Once ConvertKit/Mailchimp/Loops is connected, manage directly in that service's dashboard.

### Emptying the pantry for a user (test/support)

```typescript
// packages/core/src/pantry/clear.ts
// Use: clearPantry(adminDb, userId)
// This appends a CLEAR ledger event — reversible in principle
```

### Backfilling embeddings (new items need semantic matching)

```bash
pnpm --filter @gm/workers backfill:embeddings
```
Needs `GEMINI_API_KEY`. Run after bulk canonical item imports.

### Backfilling shelf-life classifications

```bash
pnpm --filter @gm/workers backfill:shelf-life
```
Classifies existing items that have no shelf-life domain/days set.

---

## 8. Database maintenance

### Connection pool sizing (Supabase)

The Supabase free tier has 60 direct connections. With pooling enabled (pgBouncer):
- `DATABASE_URL` → pooled (transaction mode, up to 50 concurrent connections)
- `DIRECT_DATABASE_URL` → direct (for migrations + one-off admin queries)

If you see `too many connections` errors:
1. Confirm you're using the pooled `DATABASE_URL` in Vercel (not the direct URL)
2. Check if a stuck migration is holding a connection open

### Checking RLS status

Run in Supabase SQL Editor to verify all tables are protected:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All rows should show `rowsecurity = true`.

### Checking for orphaned rows

```sql
-- pantry_stock rows with no matching user
SELECT COUNT(*) FROM pantry_stock
WHERE user_id NOT IN (SELECT id FROM users);
```

---

## 9. Cost management

### LLM spend

The app uses Gemini's cheap-first cascade (flash-lite → flash → pro). Expected per-active-user
monthly LLM cost at steady state: **$0.02–$0.10/user/month** depending on receipt import frequency.

Set a monthly budget alert in Google Cloud Console → Billing → Budgets & Alerts.

Alert threshold recommendations:
- Warning: 50% of monthly budget
- Critical: 90% of monthly budget

### Vercel spend

On the Hobby plan, the limit is 100GB bandwidth/month. The app is mobile-first and lightweight;
this should be comfortable for the first 1,000 MAU. Upgrade to Pro when bandwidth exceeds 80GB/mo.

### Supabase spend

Free tier: 500MB database, 1GB bandwidth. Upgrade to Pro ($25/mo) when:
- Database approaches 400MB
- You hit 60-connection pool limits

---

## 10. Go-live checklist (run before launch day)

- [ ] All required env vars set in Vercel production
- [ ] `pnpm --filter @gm/db db:migrate` run on production DB
- [ ] `FEATURE_BILLING=1` set (only after Stripe keys + products configured)
- [ ] Stripe webhook endpoint registered for `https://your-domain.com/api/webhooks/stripe`
- [ ] Privacy policy URL in App Store Connect / Play Console matches live `/privacy`
- [ ] Support URL in App Store Connect / Play Console: `https://your-domain.com/help`
- [ ] Plausible domain set (`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`) — verify tracking fires
- [ ] Email service connected (ConvertKit / Mailchimp / Loops) + waitlist action wired
- [ ] Test a full sign-up → pantry add → cook flow on production before launch day
- [ ] Test subscription checkout (Stripe test mode first, then live)
- [ ] Verify account deletion works end-to-end on production
- [ ] Set Gemini API cost alert (Google Cloud Console)
- [ ] Set Anthropic Console spend cap (for the hourly factory loop)

---

## 11. Troubleshooting

### Build fails with `<Html> should not be imported outside of pages/_document`

Always build with `NODE_ENV=production`:
```bash
NODE_ENV=production DATABASE_URL=postgres://... pnpm --filter @gm/web build
```

### `next build` exits 0 but there are broken imports

Grep the build log:
```bash
grep -E "Attempted import|is not exported from|was not found" build.log
```

### Migrations fail with `permission denied`

Ensure you're using `DIRECT_DATABASE_URL` (not the pooled URL) for migrations.
The pooled connection runs as a different role that can't run DDL.

### Auth: users can't sign in after a secret rotation

Expected — all sessions were invalidated. Users must sign in again.
If sign-in itself fails, check `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are set correctly.

### Gemini returns `RESOURCE_EXHAUSTED`

The free tier quota is hit. Enable billing on the Google Cloud project and set a spend cap.
The app degrades gracefully (receipt import shows "try again later"; pantry is unaffected).
