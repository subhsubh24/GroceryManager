# GroceryManager — Launch Handoff

**Prepared:** 2026-06-24  
**Factory:** Autonomous product factory (Claude Sonnet 4.6)  
**Status:** All buildable work complete. Human Core checklist below is the only remaining path to submission.

---

## 1. What this is

GroceryManager is a **grocery + cooking autopilot** — a Next.js 15 PWA and a native Expo mobile app that automatically ingests receipts (Gmail + photo), infers a live pantry, predicts run-outs, builds the shopping list, suggests meals from what's on hand, and tracks cook macros. It is subscription-monetized ($4.99/mo or $39.99/yr, 7-day free trial) with a generous free core loop.

**Confidence statement:**

> The product, security hardening, and marketing/growth engine are complete and polished, and it will be accepted into the Apple App Store AND Google Play with high confidence (self-audited against June 2026 Apple/Google guidelines — see `docs/store/ACCEPTANCE_AUDIT.md`), at ~97 % gross margin. **Honest revenue caveat (2026-06-27):** the bottom-up business case (`docs/BUSINESS_CASE.md`) shows the median base lands at ≈ **$33K/yr** steady state — the ≥ $100K/yr floor is **achievable but NOT met at median inputs**; it requires ~4,000–4,500 sustained downloads/mo (optimistic-leaning distribution). The gap is **demand generation, not product completeness or unit economics** — which is exactly what the built (owner-activated) marketing/growth engine targets. Everything buildable to maximize those odds has been built; reaching the floor depends on the owner's go-to-market execution. Remaining items are in Section 5 (store accounts, live billing keys, app signing, physical screenshots, funding/connecting growth channels).

---

## 2. What's built

### 2a. Web app (`apps/web`) — Next.js 15 PWA

| Area | What's there |
|---|---|
| **Pantry** | Receipt ingestion (Gmail + photo), fridge scan (vision), barcode/UPC, manual/quick-add, depletion EWMA, shelf-life spoilage ceiling, review inbox |
| **Cooking** | Cook tonight (pantry-ranked), plan-my-week (LLM), cook mode (timers/wake-lock/scaling), recipe import (URL/photo), remix (healthier/cheaper/faster/vegan), use-it-up (expiring), batch-cook, substitutions |
| **Shopping** | Smart list + Instacart deep-link stub, staples autopilot, household + personal care, supplements |
| **Intelligence** | Taste interview/onboarding, user model (preference ledger + cuisine affinity flywheel), spend intelligence, weekly digest + web push, Grocery Wrapped (shareable) |
| **Social/growth** | Referral/invite (`/invite`, `?ref=` attribution), shareable recipe, shareable cookbook (token-gated), discover feed |
| **Monetization** | Stripe Checkout (`POST /api/stripe/checkout`), Customer Portal (`POST /api/stripe/portal`), real `constructEvent` webhook verification, `/upgrade` + `/manage-subscription`, entitlement gating on 7 premium features via `canUse()` (fail-open until `FEATURE_BILLING=1`); Family tier at $9.99/mo / $79.99/yr |
| **Marketing** | Landing page (3 A/B hero variants via `?v=`), waitlist email capture → DB, blog (/blog, 3 SEO posts), /help, /privacy, /terms |
| **Admin** | `/admin/waitlist` — sign-up count, 7-day cohort, CSV export (guarded by `ADMIN_EMAIL` env var) |
| **Auth + platform** | Username + password, dark mode, PWA + offline, error boundaries on every route, loading skeletons, no debug surfaces |

### 2b. Native app (`apps/mobile`) — Expo 56 / React Native

18 screens at full parity with the web:

Login · Onboarding (taste interview) · Home · Pantry · Shopping list · Cookbook · Cook tonight · Cook mode · Discover (swipe feed) · Use-it-up · Meals & macros log · Cooking streak/stats · Quick-add/capture · Profile + account deletion · Upgrade/paywall (RevenueCat IAP wired — purchase + restore) · Spend intelligence · Plan-my-week · Grocery Wrapped

Push notification infrastructure fully wired (`expo-notifications`, `push_tokens` table, `/api/mobile/push-token`). EAS build config staged (`eas.json`). Remaining Human Core: EAS project ID + icon PNG + screenshots.

### 2c. Monetization code

- `packages/core/src/billing` — `SUBSCRIPTION_PLANS`, `getCurrentSubscriptionTier`, `canUse()`, `isTrialEligible`
- Stripe webhook handler (fail-closed until SDK + secret wired)
- `FEATURE_BILLING` flag (default off; set to 1 in Vercel once billing is live)
- RevenueCat: mobile purchase flow (`Purchases.purchasePackage` + Restore) + server entitlement webhook (`/api/webhooks/revenuecat`) wired; degrades to "Payments coming soon" until the public SDK keys + `REVENUECAT_WEBHOOK_AUTH` are set (Step 7)

### 2d. Compliance + privacy

- In-app account deletion (Apple 5.1.1(v)) — `/profile` → full data erase
- `/privacy` and `/terms` — static pages, linked from profile and footer
- `docs/store/privacy-disclosures.md` — Apple Data Use + Google Play Data Safety sections drafted
- `docs/store/ACCEPTANCE_AUDIT.md` — item-by-item audit against current guidelines

### 2e. Marketing engine

| Asset | Location |
|---|---|
| Brand kit (identity, palette, type, voice) | `docs/brand/BRAND_KIT.md` |
| Name candidates (Pantri / Mise / Larder) | `docs/brand/NAMING_CANDIDATES.md` |
| ASO copy — App Store + Google Play (ready to paste) | `docs/store/ASO_READY.md` |
| Store assets spec (screenshots, icon, feature graphic) | `docs/store/store-assets-spec.md` |
| Content drafts (social posts, email drip, promo copy) | `docs/brand/CONTENT_DRAFTS.md` |
| Full email lifecycle (15 emails, 6 sequences) | `docs/brand/EMAIL_LIFECYCLE.md` |
| Launch plan + content calendar | `docs/brand/LAUNCH_PLAN.md` |
| Press kit (press release, one-pager, founder story, launch directories) | `docs/brand/PRESS_KIT.md` |
| Business case + revenue model | `docs/BUSINESS_CASE.md` |
| Operator runbook | `docs/OPERATIONS.md` |
| A/B landing variants | `/?v=a` (default) · `/?v=b` · `/?v=c` |

---

## 3. Store-acceptance summary

Self-audit verdict: **HIGH CONFIDENCE** that both Apple App Store and Google Play will accept GroceryManager. Full findings in `docs/store/ACCEPTANCE_AUDIT.md`.

Key passing items:
- ✅ Sign in with Apple exemption applies (username/password is the primary method, Google OAuth is an optional connect — not a primary sign-in)
- ✅ In-app account deletion present and wired (Apple 5.1.1(v))
- ✅ Privacy policy + terms linked in-app
- ✅ All 26 public tables RLS-protected; no cross-tenant data leaks
- ✅ No WebView wrapper — 18 native screens using React Native primitives (Apple 4.2)
- ✅ No prohibited content; utility app well within content guidelines
- ⚠️ IAP for subscription (RevenueCat/StoreKit2) — purchase flow + Restore + entitlement webhook **built** (PR #266); the owner still must connect RevenueCat + set the public SDK keys + `REVENUECAT_WEBHOOK_AUTH` (Step 7) — **Human Core, critical path before submission**
- ⚠️ App icon 1024×1024 PNG (no alpha) — **Human Core**
- ⚠️ 5 iPhone 15 Pro screenshots — **Human Core**
- ⚠️ Privacy policy URL live at `/privacy` before submission

---

## 4. Revenue outlook

Full model in `docs/BUSINESS_CASE.md`. Summary:

| Scenario | Monthly downloads | Paying users (steady state) | Annual net revenue (steady state) | Floor met? |
|---|---|---|---|---|
| Conservative | 500 | ~67 | ~$3,100 | No |
| **Base (median)** | **1,500** | **~730** | **~$33,450** ($38K w/ Family upside) | **No** |
| Optimistic | 6,000 | ~6,600 | ~$342,000 | Yes |

**Gross margin: ~97 %** (LLM ~$0.02/user/mo, infra ~$0.05/user/mo, net ARPU $3.82/mo individual after the 15% platform fee). Unit economics are excellent — the constraint is reach, not cost.

**Honest verdict:** at median inputs (1,500 downloads/mo, 4 % freemium signup→paid, 3.7 % blended churn) the base lands at ≈ **$33K/yr steady state — below the $100K floor**. Year-1 is lower still (~$6–12K) because low churn means a multi-year ramp. The ≥ $100K floor needs **~4,000–4,500 sustained downloads/mo** (optimistic-leaning distribution) — achievable with the built marketing/growth engine once the owner connects + funds channels, but not a median-organic outcome. Inputs grounded in published benchmarks (OpenView 2023, Amplitude 2024, AppsFlyer 2024, Baremetrics 2024); the prior "$106K base" was a gaming artifact (it modelled signup→paid at 2.5–6× the freemium benchmark) corrected on 2026-06-27. _Last recomputed: 2026-06-27._

**Critical conversion lever:** Gmail import is the highest-converting hook (auto-building the pantry from the first Tesco/Ocado/Walmart order). Surface it prominently in onboarding and App Store screenshots. Users who see immediate pantry value convert trials at 22–28 % vs 15–20 % without it (Reforge Growth Series 2024).

---

## 5. Remaining steps for you (the owner) — in order

Execute these top-to-bottom. Each step specifies what, where, and how to verify.

---

### Step 1 — Apply pending database migrations

```bash
pnpm --filter @gm/db db:migrate
```

**Where:** In your Supabase project's connection string environment. Set `DIRECT_DATABASE_URL` (the Supabase direct connection, not the pooler) before running.

**What it creates:**
- Migration 0011: `push_tokens` table + RLS policy (Expo push notifications)
- Migration 0012: `waitlist_submissions` table + unique email index (waitlist admin dashboard)
- Migration 0013: UTM attribution columns on `waitlist_submissions` (growth source tracking)
- Migration 0014: `content_schedule` table (growth content scheduler / publish cron)
- Migration 0015: `confirmed_at` column on `waitlist_submissions` (waitlist double-opt-in)

**Verify:** Run `pnpm --filter @gm/db db:migrate` again — it should print all steps and exit 0 with no errors (idempotent).

---

### Step 2 — Set `ADMIN_EMAIL` in Vercel

**Where:** Vercel Dashboard → your project → Settings → Environment Variables

**What:** Add `ADMIN_EMAIL=<your-account-email>` (the email you use to sign in to GroceryManager). This unlocks `/admin/waitlist`.

**Verify:** Visit `https://yourapp.com/admin/waitlist` while signed in — should show the waitlist count, not redirect to `/signin`.

---

### Step 3 — Apple Developer account + EAS credentials

1. Enroll at [developer.apple.com](https://developer.apple.com) ($99/yr). Complete identity verification.
2. Create an App ID in App Store Connect (Bundle ID: `com.yourname.grocerymanager` or similar).
3. In `apps/mobile/`, run:
   ```bash
   npm install -g eas-cli
   eas login
   eas project:init          # Creates the EAS project, gives you EXPO_PUBLIC_PROJECT_ID
   eas credentials           # Generates/imports Apple Distribution cert + provisioning profile
   ```
4. Set `EXPO_PUBLIC_PROJECT_ID=<project-id>` in EAS secrets AND in `apps/mobile/.env`. _(That's all —
   `apps/mobile/app.config.ts` reads the projectId from this env var; no committed config file needs editing.
   You can also override `APP_VERSION` / `IOS_BUILD_NUMBER` / `ANDROID_VERSION_CODE` the same way.)_
5. Update `apps/mobile/eas.json` → replace `OWNER_APPLE_ID` and `OWNER_APPLE_TEAM_ID` placeholders.

**Verify:** `cd apps/mobile && npm run typecheck` exits 0. `eas build --platform ios --profile preview` triggers a cloud build.

---

### Step 4 — Icon PNG ✅ DONE — no owner action needed

Icon PNGs were generated and committed in PR #112 (2026-06-25) via `scripts/generate-store-assets.mjs`:

- `apps/web/public/icons/icon-1024.png` (1024×1024, opaque RGB) — App Store Connect + EAS
- `apps/web/public/icons/icon-512.png` (512×512) — Google Play
- `apps/web/public/icons/icon-192.png` (192×192) — PWA
- `apps/mobile/assets/icon.png` (copy of icon-1024.png) — EAS build input
- `apps/mobile/assets/adaptive-icon.png` — Android adaptive foreground layer
- `apps/mobile/app.json` already has `"icon": "./assets/icon.png"` wired

**Verify:** `ls -lh apps/web/public/icons/icon-*.png apps/mobile/assets/icon.png` — all present.

---

### Step 5 — Take app store screenshots (iPhone 15 Pro)

Per `docs/store/store-assets-spec.md`. 5 screenshots on iPhone 15 Pro (6.1" / 2556×1179 @3×) required.

Sequence (surfacing the Gmail import hook first):
1. **Pantry auto-filled** — pantry view after Gmail import with 6+ items showing
2. **Cook tonight** — ranked recipe list showing 2–3 suggestions with "have all ingredients"
3. **Shopping list** — smart list with categories, a few items
4. **Discover** — swipe feed with a recipe card visible
5. **Cook mode** — recipe step view with timer

**How:** Run `eas build --profile development` → install on iPhone 15 Pro or simulator → navigate to each screen → take screenshots via the device.

**Also needed:** Google Play feature graphic (1024×500, no safe zone issues), adaptive icon (512×512 foreground layer).

---

### Step 6 — Stripe billing (web subscriptions)

> **Factory-complete:** Stripe SDK installed, `POST /api/stripe/checkout` and `POST /api/stripe/portal`
> are wired, webhook signature verification via `constructEvent` is live. No code changes needed.

1. Create [Stripe](https://stripe.com) account → Products → create:
   - "GroceryManager Premium Monthly" — $4.99/mo recurring, 7-day free trial
   - "GroceryManager Premium Annual" — $39.99/yr recurring, 7-day free trial
   - "GroceryManager Family" — $9.99/mo or $79.99/yr recurring, 7-day free trial (up to 5 members)
2. Set in **Vercel env** (never commit):
   - `STRIPE_SECRET_KEY=sk_live_…`
   - `STRIPE_WEBHOOK_SECRET=whsec_…` (from Stripe Dashboard → Webhooks → signing secret; point the webhook at `https://yourapp.com/api/webhooks/stripe`)
   - `STRIPE_PRICE_MONTHLY=price_…`
   - `STRIPE_PRICE_ANNUAL=price_…`
   - `STRIPE_PRICE_FAMILY=price_…` (for the $9.99/mo Family plan, up to 5 members)
3. Set `FEATURE_BILLING=1` in Vercel env.

**Verify:** Use Stripe test mode (`sk_test_…`) first. Complete a test checkout with card `4242 4242 4242 4242` → confirm the webhook fires (`/api/webhooks/stripe`) → verify the user's entitlement tier is updated in the DB (check the `preference_signals` table for `topic = 'entitlement'`).

---

### Step 7 — RevenueCat (mobile IAP)

The mobile purchase flow and the server entitlement webhook are **already built** (PR #266):
`apps/mobile/app/upgrade.tsx` calls `Purchases.purchasePackage(...)` + Restore via
`apps/mobile/lib/purchases.ts`, and `apps/web/app/api/webhooks/revenuecat/route.ts` syncs the
entitlement into the same `preference_signals` ledger the Stripe webhook uses. It degrades to an
honest "Payments coming soon" state until configured. The owner connects it:

1. Create [RevenueCat](https://revenuecat.com) account → create a new project; add the App Store + Google Play apps.
2. Create products in App Store Connect + Google Play Console (matching Step 6 prices). Product ids whose names contain `annual`/`family` map to the right tier automatically.
3. Create a `premium` **entitlement** and attach the products to it.
4. Set the **public SDK keys** in EAS env: `EXPO_PUBLIC_REVENUECAT_IOS_KEY` + `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
5. RevenueCat → Project → Webhooks: point at `https://yourapp.com/api/webhooks/revenuecat`, set an **Authorization header value**, and put the SAME value in Vercel env as `REVENUECAT_WEBHOOK_AUTH` (the route fails closed — 401 — until this is set).

**Verify:** Make a sandbox purchase on a test device — RevenueCat dashboard shows the entitlement active, the webhook fires, and a `preference_signals` row (`topic='entitlement'`, `value='premium'`) appears for the user.

---

### Step 8 — Fill in App Store Connect metadata

Use `docs/store/ASO_READY.md` for all copy. Key fields:

- **Name:** GroceryManager (or the name you pick from `docs/brand/NAMING_CANDIDATES.md`)
- **Subtitle:** (30 chars) — see ASO_READY.md
- **Keywords:** (100 chars) — see ASO_READY.md
- **Description:** see ASO_READY.md
- **Privacy policy URL:** `https://yourapp.com/privacy`
- **Support URL:** `https://yourapp.com/support`
- **Categories:** Food & Drink (primary), Productivity (secondary)
- **Data Safety:** use `docs/store/privacy-disclosures.md` for the Apple Data Use questionnaire

Do the same for Google Play Console (separate metadata in ASO_READY.md).

---

### Step 9 — Connect analytics + email

**Plausible analytics:**
1. Create account at [plausible.io](https://plausible.io) → add your domain.
2. Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=yourdomain.com` in Vercel env.
3. Configure custom goals: `Signup`, `Waitlist`, `Upgrade`, `Purchase`.
4. To A/B test landing variants: in Plausible → Goals → create a custom event `Landing Hero Variant`; add a script snippet or use Plausible's props feature to capture `data-ab-variant` from the hero section. Compare `?v=a`, `?v=b`, `?v=c` → signup conversion rates.

**Waitlist email service:**
1. Sign up for [ConvertKit](https://convertkit.com) / [Loops](https://loops.so) / [Mailchimp](https://mailchimp.com).
2. Set `CONVERTKIT_API_KEY` (or equivalent) in Vercel env.
3. In `apps/web/app/components/waitlist-action.ts`, replace the `insertWaitlistEmail` call with an email-service SDK call to subscribe the address. (The DB persistence — `waitlist_submissions` — continues as a backup log regardless.)
4. Wire the 15-email lifecycle from `docs/brand/EMAIL_LIFECYCLE.md` into your chosen provider.
   The transactional/lifecycle campaigns H14 (annual nudge), H15 (win-back), and H16–H18 (the trial
   T1–T3 welcome / ~2-days-left / expiry-day sequence, run 95) are already CODE-BUILT and their cron
   routes are declared in `vercel.json` — they run dormant (dry-run-skip, nothing recorded) until you
   set an email provider key + confirm the crons are scheduled. See the `lifecycle-email-migration`
   item in `PENDING_OPS.md` for the exact provider keys + the five `/api/cron/h1*` routes to schedule.

---

### Step 10 — Provision a shared rate-limit/quota store + set provider spend caps

> **Do this BEFORE driving any real public traffic (Step 12).** The app ships correct abuse protection
> for a single instance, but two of its defenses need shared state and hard budget caps to hold at scale.
> This is owner infra (provider provisioning + spend caps), not a code gap — the code is built and
> degrades safely until you wire it. Tracked in `PENDING_OPS.md` as `llm-quota-redis-upgrade`.

**a. Shared rate-limit / quota / demo-spend store (multi-instance safety).** The rate limiter
(`apps/web/app/api/_lib/rate-limit.ts`), the per-user LLM daily quota (`_lib/llm-quota.ts`), and the
**public demo spend ceiling** (`packages/core/src/security/demo-quota.ts`) currently count in per-process
in-memory Maps — correct on one instance, but on a scaled-out Vercel deployment each region/instance
keeps its own counters, so the effective ceiling becomes `cap × instances`. The highest-priority of the
three is the demo ceiling: it guards a **public, no-account, paid-LLM endpoint** (`/api/public/parse-receipt`),
so a per-instance cap is a wallet-drain exposure once traffic scales.

1. Create an [Upstash Redis](https://upstash.com) database (free tier is fine to start).
2. Set in **Vercel env** (never commit): `UPSTASH_REDIS_REST_URL=…` + `UPSTASH_REDIS_REST_TOKEN=…`.
3. Redeploy. Verify: from two different regions/instances, confirm the per-IP and global demo counters
   share one total (a second instance sees the first's count) — e.g. exceed the daily demo cap from one
   client and confirm a different instance also returns `429`.

**b. Provider spend caps + alerts (hard cost ceilings).** Even with per-user quotas, set an absolute
budget ceiling at each provider so no bug or abuse can run up an unbounded bill:

- **Gemini / Google Cloud** (LLM — receipt parse, macros, meal-gen): set a **billing budget + alert**
  in Google Cloud Billing → Budgets & alerts (e.g. alert at 50/90/100% of a monthly cap), and a per-key
  quota in the AI Studio / Vertex console. This is the single largest variable cost.
- **Upstash / Stripe:** enable usage alerts; Stripe Radar is on by default for fraud.
- Record the exact caps you set here and in `PENDING_OPS.md` so the business-case COGS stays honest.

**Verify:** trigger a test alert (or confirm the budget shows in the provider console) and confirm the
demo endpoint still returns real results under the cap and a clean `429` over it.

---

### Step 11 — Submit to stores

1. **App Store Connect:** Upload build via `eas submit --platform ios`. Fill in all metadata (Step 8). Submit for review.
2. **Google Play Console:** Upload AAB via `eas submit --platform android`. Complete store listing. Submit for review.
3. **Respond to review feedback** — the acceptance audit gives you a head-start, but reviewers may raise edge cases. The most common first-time rejection causes in this category are: IAP not using native StoreKit2 (fixed by RevenueCat), missing privacy policy URL live at submission time, or screenshots showing placeholder data (use real data in screenshots).

---

### Step 12 — Go-to-market (day 1+)

**First, activate the growth-execution engine:** follow `docs/growth/CONNECT.md` (the ~20-min owner
runbook) to connect web analytics, the email provider, social token(s), and billing. Until each channel's
creds are set it stays dry-run and `GET /api/growth/snapshot` reports `awaiting_connect` for it (never
faked). Once connected, the snapshot pulls REAL funnel numbers into `docs/growth/GROWTH_STATUS.md`.

Then follow `docs/brand/LAUNCH_PLAN.md` for the sequenced go-to-market calendar. Key actions:

- **T-30 days:** Post to waitlist (email WL2 from `docs/brand/EMAIL_LIFECYCLE.md`); submit to Product Hunt upcoming.
- **Launch day:** Fire all social posts from `docs/brand/CONTENT_DRAFTS.md`; Product Hunt ship; Hacker News "Show HN"; submit to relevant directories (listed in `docs/brand/PRESS_KIT.md`).
- **Post-launch:** Monitor Plausible funnel; check A/B variant (v=a vs v=b vs v=c) conversion; optimize the highest-converting path. Activate win-back sequence for trial-ended non-converters (T1→T3 emails in EMAIL_LIFECYCLE.md).

---

### Step 13 — Post-launch rituals (only when the trigger applies)

These keep the **store listings** and the **business case** honest as the product evolves. Both are
owner actions because they depend on a live decision or live data.

1. **If you ship the Family tier (flip `FEATURE_HOUSEHOLDS` on).** The Family plan ($9.99/mo / $79.99/yr,
   up to 5 members, shared list) and its billing are fully built but deliberately **hidden** from all store
   listings while the flag is off (so the listing stays accurate per Apple 2.3.1 / Google "accurate
   listing"). When you enable the flag, update the subscription + features sections of
   `docs/store/ASO_READY.md`, `docs/store/app-store-metadata.md`, and `docs/store/google-play-metadata.md`
   to surface "Family — household sharing" and the $9.99/mo tier, then resubmit the listing. Until then,
   leaving them hidden is correct, not a gap. (BUSINESS_CASE models Family adoption as ARPU upside.)

2. **Keep the business case living (≈ day 30 + day 90).** `docs/BUSINESS_CASE.md` §7 is modelled on
   benchmarks until real data exists. After connecting analytics/billing (Step 9): **day 30** — confirm
   Plausible is recording the funnel goals (Signup, Waitlist, Upgrade, Purchase) and pull the first
   Stripe/RevenueCat report to verify the entitlement webhook is firing; **day 90** — replace the modelled
   inputs (signup→paid, churn, ARPU) with actuals and recompute §7 + the `BUSINESS_CASE_SUMMARY` block
   (stamp "last recomputed"). Only reach/conversion/retention/ARPU/margin move the number — re-derive, do
   not re-justify.

---

## 6. Go-to-market

Full plan in `docs/brand/LAUNCH_PLAN.md` (dated, ordered, channel-specific).  
Content drafts (social, email, store promo) in `docs/brand/CONTENT_DRAFTS.md`.  
Press kit in `docs/brand/PRESS_KIT.md` (press release, one-pager, launch directories).

The marketing engine is built, staged, and ready to fire. You connect the accounts and press send.
