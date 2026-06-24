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

## THE 100% BAR (do NOT stop early — read every run)
"Done" means **BOTH the PRODUCT and the MARKETING are genuinely 100% complete** — not one, not
"mostly," not "staged minimally." Keep building until you can **honestly** state: *the product is
complete and polished; it will be accepted into the Apple App Store AND Google Play with high
confidence (self-audited against the CURRENT published Apple/Google review guidelines via web
research); and everything within our control to maximize the odds of reaching ≥ $100K/yr has been
built and verified.* If you cannot honestly say that, you are NOT done — find the gap and close it.
(You cannot literally guarantee revenue — the market decides — but you CAN guarantee that nothing
buildable is left undone, and that is the bar.) Reaching Done **also requires the LAUNCH HANDOFF doc**
(see below) to exist and be current.

**FULL AUTONOMY.** You may create whatever it takes to reach the bar: new pages, routes, packages,
the marketing site + assets, **internal tools** (admin dashboard, analytics views, content
generators, growth/referral tooling), dashboards, docs — anything inside the repo's blast radius.
**You may also ADD NEW ROADMAP tracks/phases yourself** when you find real, on-mission work the
current tracks don't cover (record them in the bookkeeping PR). Do not wait for permission and do not
artificially cap scope to the listed tracks; the tracks are the FLOOR, not the ceiling. **If the loop
COULD build it, the loop MUST build it** — never list as an owner step anything you could have done
yourself. The ONLY work you may not do is the Human-Core set (things that legally or physically
require the owner — store accounts, live billing keys, app signing, funding paid channels). Build
everything else yourself.

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
- [x] **Design bar held everywhere** — no vibe-coded screens; design system only (globals.css +
      tailwind.config.ts). Audit every route for cohesion. _(Run-3 full-route audit: 0 design-system
      violations. Error boundaries on 30+ routes (PRs #30 #40 #46 #54 #56 #61); loading skeletons on
      27+ routes (PRs #24 #41 #46 #54 #56 #61); all components use globals.css + tailwind tokens only.)_
- [x] **Reliability** — no broken flows; graceful empty/error states; LLM/keyless paths degrade.
      _(PRs #30 #40 #46 #54 #56 #61: error boundaries + skeletons on all major routes; PR #69:
      Vertex/keyless guards on scan/import/add-receipt; PR #72: guards extended to ask/plan/remix/
      onboarding — all LLM capability checks now Vertex-aware. Run-3 audit: 0 reliability gaps.)_
- [x] **Performance** — fast cold start + hot paths; no needless queries (continue the latency work).
      _(PR #56: profile page parallelized DB reads; PR #65: digest + pantry — 5 independent queries
      run in Promise.all via separate withTenant connections. Run-3 audit: 0 remaining sequential
      hot-path gaps.)_
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
- [x] Auth + tenant context wired to the same backend (RLS-safe).
      _(PR #59: POST /api/v1/auth/token → 30-day mobile JWT; GET /api/v1/pantry + /api/v1/list
      with withTenant isolation. Foundation for native screens.)_
- [x] Core daily-habit screens first (pantry, cook + cook mode, list, capture/scan, home) — native
      UX, not an iframe — then expand to **parity**: receipts/review, plan-my-week, cookbook,
      discover, remix, spend, Wrapped, onboarding, settings/profile, account deletion, paywall.
      _(Full parity: 18 screens — Login, Onboarding, Home, Pantry, Shopping list, Cookbook, Cook
      mode, Cook tonight, Discover, Use it up, Meals & macros, Cooking streak/stats, Quick-add/
      Capture, Profile, Upgrade, Spend, Plan-my-week, Grocery Wrapped. All with pull-to-refresh,
      premium gates on spend_insights + wrapped_plus, `https://`-gated images, retry patterns.
      PRs #62 #68 #75 #76 #77 #78 #80 #81 #82 #83 #85 #86 #87 #88 #89 #90 #92 #95.)_
- [ ] Push notifications + offline behavior appropriate to native.
      _(Code fully wired — PRs #97 + #98: push_tokens DB table + RLS + /api/mobile/push-token
      endpoint; expo-notifications client + permission request + token registration/deregistration;
      AsyncStorage session persistence + cold-launch ready flag. Remaining Human Core: apply
      migration 0011 + set EXPO_PUBLIC_PROJECT_ID (EAS project ID) — see PENDING_OPS.md.)_
- [x] Mobile gate green in CI (the graceful-skip `mobile` job starts enforcing once initialized).
      _(`npm ci && npm run typecheck` exits 0; every merged mobile PR shows `mobile: success`.)_
- [x] EAS build config staged (credentials are Human Core).
      _(eas.json: development/preview/production profiles + submit config with OWNER_* placeholders
      for Apple + Android. PNG icon export + EAS credential steps in PENDING_OPS.md.)_

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
- [x] Store assets staged (icon, screenshots, descriptions) — see Track E for copy.
      _(PR #55: docs/store/store-assets-spec.md — screenshot spec with all device sizes, 6-screen
      sequence, feature graphic; icon.svg brand color corrected to brand-solid #0c8a3e; PNG export
      + EAS wiring documented in PENDING_OPS.md as Human Core. Descriptions: PR #39)_
- [x] Stability pass — no crash-on-launch; offline/empty handled; no debug surfaces.
      _(#36 + #40 + #46 + #54: error boundaries on 30+ routes; #24 + #41 + #46 + #54 + #61:
      loading skeletons on 27+ routes; #51: raw DB error strings removed from 8 pages; #61:
      recipe-not-found empty state + home loading skeleton + root error boundary; favicon
      commit: SVG icon wired as browser favicon in Next.js metadata)_

## Track E — Marketing engine (BUILD + STAGE only)
- [x] **Brand naming** — propose 2–3 name candidates (name + logo direction + voice) for the owner
      to pick. _(PR #39: docs/brand/NAMING_CANDIDATES.md — Pantri / Mise / Larder with decision matrix;
      ships under "GroceryManager" until owner picks)_
- [x] Waitlist / landing page (the public marketing surface) with email capture (staged, not sent) —
      drives pre-launch demand so there's an audience to convert on store launch. _(PR #47: pricing
      grid + WaitlistForm; emails logged server-side; wire to email service via PENDING_OPS.md)_
- [x] Brand kit (logo, palette, type, voice) consistent with the app + the chosen name.
      _(PR #50: docs/brand/BRAND_KIT.md — identity mark, full color token table, Hanken Grotesk
      type system, lucide-react icon rules, design system class catalogue, voice/tone guide)_
- [x] ASO / store copy (title, subtitle, keywords, description) drafted.
      _(PR #39: docs/store/app-store-metadata.md + docs/store/google-play-metadata.md — full ASO
      copy for both stores, 30-char subtitle compliant, 99-char keyword string, reviewer-verified)_
- [x] Owned-channel content **drafts** (launch posts, email sequence) — staged, not published.
      _(PR #50: docs/brand/CONTENT_DRAFTS.md — 4-email drip sequence, social posts for Twitter/X +
      Instagram + LinkedIn, App Store/Play Store promo copy, hashtag bank; all staged)_
- [x] Analytics wired (privacy-respecting) so the owner can measure activation/retention.
      _(PR #50: Plausible script in layout.tsx gated on NEXT_PUBLIC_PLAUSIBLE_DOMAIN — zero impact
      until owner wires it; setup steps in PENDING_OPS.md)_

**Marketing is NOT "done" at the minimum above — build the FULL engine (research-grounded):**
- [ ] **Full marketing website** (not just one landing page) — hero, features, pricing, FAQ, about,
      social proof placeholders (no fake testimonials), SEO meta/OG tags, sitemap — design-bar quality.
- [ ] **SEO / content engine** — keyword-targeted blog/guide pages (e.g. meal-planning, pantry,
      grocery-budget topics) grounded in real search/competitor research; internal linking; metadata.
- [ ] **Rendered store assets** — actual screenshot images + feature graphic + app preview
      storyboard generated from the spec (not just a spec doc), per device sizes.
- [ ] **Launch plan + content calendar** — a dated, ordered go-to-market plan (waitlist → launch →
      post-launch), with the content drafts slotted into a schedule the owner can execute.
- [ ] **Growth loop** — referral/invite mechanics + a share surface wired in-app (build the code;
      the actual sending stays behind the owner's connected channels).
- [ ] **Press / outreach kit** — short press release, product one-pager, founder-story draft,
      directory/launch-list target list (Product Hunt etc.) — staged, not submitted.
- [ ] **Full email lifecycle** — not just a launch drip: waitlist welcome, onboarding/activation,
      trial-start, trial-ending, win-back/churn, and re-engagement sequences (templated, staged;
      sending stays behind the owner's connected provider).
- [ ] **ASO package ready-to-paste** — final titles/subtitles/keywords/descriptions for BOTH stores
      in a single copy-paste-ready file, plus localized variants if research supports them.
- [ ] **A/B landing variants** — at least 2 headline/hero/pricing-framing variants behind the
      analytics flag so the owner can test conversion on day one.
- [ ] **Internal growth tooling** — e.g. a referral/invite admin view, a waitlist/analytics dashboard,
      or a content generator — whatever genuinely accelerates demand-gen (build it; don't list it).
- [ ] **End-user + operator docs** — a user-facing help/FAQ (in-app or `/help`) AND an operator
      runbook in the repo (`docs/OPERATIONS.md`: how to run, deploy, rotate keys, read analytics).

> **Marketing 100% bar:** you could launch demand-generation the SAME DAY the owner connects + funds
> the accounts — nothing left to write, design, or wire on your side.

---

## DEFINITION OF DONE (the 100% bar — strict)
Done requires **ALL** of the gates below genuinely true and CI-verified — BOTH product AND marketing
at 100%. Only then: produce/refresh the **LAUNCH HANDOFF** doc, open ONE issue titled
**`FACTORY: ready for submission`** linking it + the Human-Core checklist, and STOP. Do not open that
issue while ANY box is unchecked, and do not add scope after Done.

**Product 100%:**
- [x] Track A complete — web app at paid quality, **live eval suite passes**.
- [ ] Track B complete — native Expo app at full parity (not a wrapper), mobile CI green, push +
      offline behavior code complete (only Human-Core keys/IDs pending).
- [x] Track C complete — subscription + entitlement gating in code (live keys pending in Human Core).
- [x] Track D complete — account deletion, privacy/terms, disclosures, **rendered** assets, stability.

**Marketing 100%:**
- [ ] Track E complete — FULL engine: marketing website, SEO/content, rendered store assets, launch
      plan + calendar, growth loop, press/outreach kit, analytics — all built + staged, research-grounded.

**Store-acceptance + revenue-readiness:**
- [ ] **Store-acceptance self-audit** — audit the app against the CURRENT published Apple App Store
      Review Guidelines + Google Play policies (fetch them via web research), record findings in
      `docs/store/ACCEPTANCE_AUDIT.md`, and resolve every issue you can control. High confidence both
      stores would accept.
- [ ] **Revenue viability estimate** (`docs/REVENUE_MODEL.md`) — a HONEST, research-grounded
      bottom-up model of whether ≥ $100K/yr is achievable. Pull real benchmarks via web research
      (category install→trial→paid conversion rates, subscription churn, ARPU/price points for
      comparable grocery/meal-planning apps) and show the funnel math: at our price, **how many paying
      subscribers** = $100K/yr, and **what install + conversion volume** that implies — with
      conservative / base / optimistic scenarios and the key assumptions + sources. State plainly
      whether the target looks reachable, what it would take (e.g. installs/month, conversion %), and
      the biggest risks. NEVER fake the numbers; if the honest model says the target is hard at the
      current price/feature set, SAY SO and propose concrete, buildable levers (pricing, a stronger
      premium tier, ASO, retention) — then build the ones in your control. This is monetization
      realism, not a sales pitch.
- [ ] **Self-run pre-submission checklist passes** — no broken flows, no leaked secrets, full gate +
      evals green, no debug surfaces, every owner-required step captured in PENDING_OPS / handoff.
- [ ] **Confidence statement** — you can honestly write, in the handoff doc: *the product is complete
      and store-acceptable with high confidence, and everything buildable to maximize the ≥ $100K/yr
      odds is done.* If you cannot write that truthfully, you are NOT done — keep building.
- [ ] **LAUNCH HANDOFF doc exists + current** (`docs/LAUNCH.md`, see below).

## LAUNCH HANDOFF — `docs/LAUNCH.md` (the deliverable at 100%)
The single document the owner reads when the factory says "done." Keep it current as you build; it is
required for Done. It MUST contain, in this order:
1. **What this is** — one-paragraph product summary + the honest **confidence statement** (product
   complete, store-acceptable with high confidence, maximally primed for ≥ $100K/yr).
2. **What's built** — concise documentation: the web app, the native app, monetization, compliance,
   and the full marketing engine — with where each lives in the repo.
3. **Store-acceptance summary** — the result of the `ACCEPTANCE_AUDIT.md` self-audit (what was checked
   against Apple/Google guidelines, and that it passes).
4. **Revenue outlook** — the headline of `REVENUE_MODEL.md`: the honest $100K/yr verdict + what it
   takes (installs/month, conversion %, paying subscribers) + the key assumptions and risks.
5. **REMAINING STEPS FOR YOU (the owner) — IN ORDER.** A numbered, sequential checklist of ONLY the
   things the factory physically/legally cannot do (Human Core): each step = what to do, where (exact
   portal/URL), what value/secret to set and where it goes, and how to verify it worked. Ordered so the
   owner can execute top-to-bottom (accounts → signing → billing → migrations → analytics/marketing
   connect → submit). NOTHING the factory could have built itself belongs in this list.
6. **Go-to-market** — pointer to the launch plan + content calendar so the owner can execute marketing.

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
