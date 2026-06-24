# GroceryManager — Product Factory ROADMAP (convergence anchor)

> Read this every run alongside **[VISION.md](./VISION.md)**. This is the **convergence anchor** for
> the autonomous product factory: advance the **lowest-numbered incomplete track**, with the
> highest-value, **file-disjoint** changes that clear the value bar — coherence over volume — until
> the **Definition of Done** is genuinely met and CI-verified, then **STOP** and hand off for
> submission. Historical per-iteration build notes live in [docs/ROADMAP.md](./docs/ROADMAP.md)
> (legacy loop memory); durable lessons live in
> [docs/autonomous-loop/LOOP_MEMORY.md](./docs/autonomous-loop/LOOP_MEMORY.md).

## Goal (one sentence)
Ship GroceryManager as a **web app + native Expo mobile app**, **subscription-monetized**, that is
**store-acceptable with high confidence** and primed to earn **reliable, consistent revenue — target
≥ $100K/yr** — as a dependable side income.

## Operating model
- **Milestone/phase-driven, coherence over volume.** A store-acceptable app is one cohesive product,
  not a pile of disconnected PRs. Advance the lowest incomplete track first.
- **Cheapest viable model.** Architecture + review on Sonnet; high-volume scouting on Haiku.
- **Tick a box only when it is genuinely done** (CI-verified) — and only in the **bookkeeping PR**,
  never inside a code branch.
- **Adapt to this repo, never copy another's specifics:** RLS uses the `grocery_app` role +
  `app_current_user_id()` GUC (`packages/db/sql/0002_rls.sql`), NOT `auth.uid()`. The native app
  lives in `apps/mobile` (excluded from the pnpm workspace). Gate = `pnpm -r run typecheck` ·
  `pnpm -r run test` · `NODE_ENV=production DATABASE_URL=… pnpm --filter @gm/web build`.

## Product decisions (LOCKED — owner, 2026-06-24)
These are settled; build to them, do not re-litigate.
1. **Revenue model: SUBSCRIPTION ONLY.** No affiliate/Instacart/Amazon ordering revenue in v1 —
   explicitly OUT OF SCOPE (ignore the legacy affiliate items in `docs/ROADMAP.md`). One clean
   subscription is the path; keeps store review simple.
2. **Free vs paid: GENEROUS FREE + PREMIUM POWER TIER.** The core loop (pantry, cook, list,
   capture/scan, plan) stays FREE to drive downloads + word-of-mouth. **Premium** unlocks power
   features — candidate set (factory refines, keep it compelling): unlimited AI meal plans &
   remix, automatic Gmail receipt import, family/household sharing, advanced spend insights,
   unlimited photo/barcode scans, Grocery Wrapped+. Premium must gate REAL value, never core utility.
   Suggested price (owner confirms in App Store Connect / Stripe — Human Core): ~$4.99/mo or
   ~$39.99/yr with a 7-day free trial.
3. **Mobile scope: FULL PARITY with the web app** before submission (not a focused subset). The
   native app should reach feature parity with `apps/web`, reusing `@gm/core` engines.
4. **Brand/name: factory PROPOSES 2–3 names** (name + logo direction + voice) as an early Track E
   deliverable; ship under the working title "GroceryManager" until the owner picks one. The chosen
   name then propagates to app metadata + store assets.

---

## Track A — Web app → paid quality
The web PWA is feature-rich already (receipts→pantry, scan, cook/plan, cookbook, discover, spend,
Wrapped, dark mode). Get it to **"people happily pay monthly"** quality.
- [ ] **Design bar held everywhere** — no vibe-coded screens; design system only (globals.css +
      tailwind.config.ts). Audit every route for cohesion.
- [ ] **Reliability** — no broken flows; graceful empty/error states; LLM/keyless paths degrade.
- [ ] **Performance** — fast cold start + hot paths; no needless queries (continue the latency work).
- [x] **Security/RLS** — every public table RLS-protected. _Audit 2026-06-24: zero violations — no
      SECURITY DEFINER functions; all 26 public tables RLS-enabled with correct policies._
- [x] **EVAL COVERAGE (first-class)** — grow the live `RUN_EVALS`-gated suites
      (`packages/core/src/llm/evals/*.eval.test.ts`) to cover every core LLM stage (receipt
      extraction, recipe import, remix, meal-gen, capture) with **real** golden fixtures, pass-rate
      floors, and the ratchet. _(PR #45: capture-parse + meal-gen suites complete 5-stage coverage;
      80% / 75% pass-rate floors + ratchet guards)_

## Track B — Native Expo mobile app (`apps/mobile`) — FULL PARITY
A **real** app reusing `@gm/core` engines — NOT a thin WebView wrapper (Apple 4.2). Target **full
feature parity with `apps/web`** before submission (owner decision, locked).
- [x] Initialize Expo / expo-router in `apps/mobile` (deps + `tsconfig.json` + `typecheck` script);
      keep it out of the root `pnpm install` if that protects web CI, but make it independently
      installable + typecheckable (the `mobile` CI job enforces once this exists). _(PR #48: Expo
      56.0.12 / expo-router 56.2.11 / RN 0.85.3 / TS 6.0.3; @gm/core/* via tsconfig paths;
      npm install && npm run typecheck exits 0)_
- [ ] Auth + tenant context wired to the same backend (RLS-safe).
- [ ] Core daily-habit screens first (pantry, cook + cook mode, list, capture/scan, home) — native
      UX, not an iframe — then expand to **parity**: receipts/review, plan-my-week, cookbook,
      discover, remix, spend, Wrapped, onboarding, settings/profile, account deletion, paywall.
- [ ] Push notifications + offline behavior appropriate to native.
- [ ] Mobile gate green in CI (the graceful-skip `mobile` job starts enforcing once initialized).
- [ ] EAS build config staged (credentials are Human Core).

## Track C — Monetization (SUBSCRIPTION ONLY)
Scaffold exists: `@gm/core/billing` + `/upgrade` behind `FEATURE_BILLING` (fail-open, no live keys).
Subscription is the **only** revenue stream in v1 (no affiliate ordering — see Product decisions).
- [x] Subscription model: **monthly + annual + 7-day free trial**, with server-side **entitlement
      gating** of the premium power tier. _(PR #42: SUBSCRIPTION_PLANS + getCurrentSubscriptionTier +
      isTrialEligible; PR #38: canUse() gating on discover/plan/remix — fail-open when FEATURE_BILLING
      off; fail-closed remix path outside try/catch)_
- [x] Define the FREE vs PREMIUM feature split in code — gate real value, never core utility.
      _(PR #42: PREMIUM_FEATURES 3→7: plan_week, discover, remix, gmail_import, household,
      spend_insights, wrapped_plus)_
- [x] RevenueCat (mobile) / Stripe (web) integration **code** — keys in env, **never committed**;
      webhook handlers + entitlement sync. _(PR #42: Stripe webhook skeleton handles
      customer.subscription.created/updated/deleted → PreferenceSignal ledger via getAdminDb();
      fail-closed when STRIPE_WEBHOOK_SECRET set until SDK + constructEvent wired;
      REVENUECAT_API_KEY in env schema)_
- [x] Clear paywall + manage-subscription UX within the design bar (web `/upgrade` + `/manage-subscription`).
      _(PR #42: /manage-subscription — tier display, pricing cards, billing portal placeholder;
      profile page linked)_
- [x] All live keys / product IDs / prices / go-live config recorded in `PENDING_OPS.md` as **Human
      Core**. _(2026-06-24 PENDING_OPS entry: Stripe account + keys + SDK install + constructEvent
      wiring + FEATURE_BILLING=1 — all Human Core)_

## Track D — Store readiness & compliance
- [x] **In-app account deletion** (Apple 5.1.1(v)) — full data erase path. _(PR #30: deleteUserAndAllData via ON DELETE CASCADE; danger zone UI + typed confirmation in /profile)_
- [x] **Privacy policy + terms** pages, linked in-app and in store metadata. _(PR #32: /privacy + /terms static pages; linked from /profile footer)_
- [x] **App Privacy (Apple) / Data Safety (Play)** disclosures drafted from actual data flows.
      _(PR #37: docs/store/privacy-disclosures.md — all 12 Apple categories + Play Data Safety +
      Gmail Limited Use Policy statements + owner action checklist with portal navigation paths)_
- [ ] Store assets staged (icon, screenshots, descriptions) — see Track E for copy.
- [ ] Stability pass — no crash-on-launch; offline/empty handled; no debug surfaces.
      _(Partial: error boundaries on 28 routes — #36 + #40 + #46; loading skeletons on 15+ routes — #24 + #41 + #46)_

## Track E — Marketing engine (BUILD + STAGE only)
- [x] **Brand naming** — propose 2–3 name candidates (name + logo direction + voice) for the owner
      to pick. _(PR #39: docs/brand/NAMING_CANDIDATES.md — Pantri / Mise / Larder with decision matrix;
      ships under "GroceryManager" until owner picks)_
- [x] Waitlist / landing page (the public marketing surface) with email capture (staged, not sent) —
      drives pre-launch demand so there's an audience to convert on store launch. _(PR #47: pricing
      grid + WaitlistForm; emails logged server-side; wire to email service via PENDING_OPS.md)_
- [ ] Brand kit (logo, palette, type, voice) consistent with the app + the chosen name.
- [x] ASO / store copy (title, subtitle, keywords, description) drafted.
      _(PR #39: docs/store/app-store-metadata.md + docs/store/google-play-metadata.md — full ASO
      copy for both stores, 30-char subtitle compliant, 99-char keyword string, reviewer-verified)_
- [ ] Owned-channel content **drafts** (launch posts, email sequence) — staged, not published.
- [ ] Analytics wired (privacy-respecting) so the owner can measure activation/retention.

---

## DEFINITION OF DONE (stop condition)
When **all** of these are genuinely true and CI-verified, STOP building, open ONE issue titled
**`FACTORY: ready for submission`** with the Human Core checklist below, and exit. After Done, do not
add scope.
- [ ] Track A complete — web app at paid quality, **live eval suite passes**.
- [ ] Track B complete — native Expo app real (not a wrapper), mobile CI green.
- [ ] Track C complete — subscription + entitlement gating in code (live keys pending in Human Core).
- [ ] Track D complete — account deletion, privacy/terms, disclosures, assets, stability.
- [ ] Track E complete — landing, brand kit, store copy, content drafts, analytics — all staged.
- [ ] Self-run pre-submission checklist passes (no broken flows, no leaked secrets, gate + evals green).

## HUMAN CORE (the unavoidable ~5% — only the owner can do these)
- Apple Developer account ($99/yr) + Google Play account ($25) + identity verification.
- App signing / EAS credentials.
- Live billing setup (RevenueCat/Stripe accounts, products, prices, webhooks).
- **Apply pending DB migrations** listed in `PENDING_OPS.md`.
- Connect + **fund** marketing / ad / social / analytics accounts.
- Final store submission + responding to review.
- **Set the Anthropic Console spend cap** — the only true ceiling on this hourly factory.

## MARKETING AUTONOMY BOUNDARY
The loop may **build and stage** everything in Track E. It may **NOT** publish publicly, send bulk
email, or spend ad money until the owner connects + funds the account. It never invents claims or fake
metrics, and never posts under the owner's identity without a connected, authorized channel.

## GUARDRAILS (carried into every run)
Design bar · determinism · cheap-first LLM cost contract · **security/RLS** (grocery_app + GUC model;
new public tables must enable RLS in the same change; never weaken or FORCE RLS) · **live secrets +
DB migrations are Human-Applied** (record in `PENDING_OPS.md`, never run/commit) · never edit
`.claude/` or `.github/` from the loop · never relax a guard test or the gate.
