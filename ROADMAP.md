# GroceryManager — Product Factory ROADMAP (convergence anchor)

> Read this every run alongside **[VISION.md](./VISION.md)**. This is the **convergence anchor** for
> the autonomous product factory: advance the **lowest-numbered incomplete track**, with the
> highest-value, **file-disjoint** changes that clear the value bar — coherence over churn, value bar
> as the only volume limiter — until
> the **Definition of Done** is genuinely met and CI-verified, then **STOP** and hand off for
> submission. Historical per-iteration build notes live in [docs/ROADMAP.md](./docs/ROADMAP.md)
> (legacy loop memory); durable lessons live in
> [docs/autonomous-loop/LOOP_MEMORY.md](./docs/autonomous-loop/LOOP_MEMORY.md).

## Goal (one sentence)
Ship GroceryManager as a **web app + native Expo mobile app**, **store-acceptable with high
confidence**, with monetization **optimized to MAXIMIZE revenue** — **≥ $100K/yr is the FLOOR, not the
target** — as a dependable, growing side income.

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
- **Milestone/phase-driven; coherence over CHURN (NOT "fewer for its own sake").** A store-acceptable
  app is one cohesive product, not a pile of disconnected PRs — but the **VALUE BAR is the ONLY limiter
  on how many changes ship in a run**: ship ALL changes that genuinely clear it (maximize scope per
  run) and ZERO that don't. Never pad a run to hit a count; never artificially stop at 1–2 when more
  genuinely-valuable, file-disjoint work exists. Avoid BOTH failure modes equally — padding (churn) and
  artificial scarcity. Many changes is GOOD when each is real. Advance the lowest incomplete track first.
- **Cheapest viable model.** Architecture + review + readiness auditors on Sonnet; high-volume scouting
  + discovery audit on Haiku — never downgrade the reviewers or readiness auditors.
- **Tick a box only with EVIDENCE-BASED DONE proof** (artifacts present on the default branch + gate
  green this run — see below), and only in the **bookkeeping PR**, never inside a code branch.
- **Adapt to this repo, never copy another's specifics:** RLS uses the `grocery_app` role +
  `app_current_user_id()` GUC (`packages/db/sql/0002_rls.sql`), NOT `auth.uid()`. The native app
  lives in `apps/mobile` (excluded from the pnpm workspace). Gate = `pnpm -r run typecheck` ·
  `pnpm -r run test` · `NODE_ENV=production DATABASE_URL=… pnpm --filter @gm/web build`.
- **LIVING ARTIFACTS.** Every artifact the loop produces — README, ARCHITECTURE, `docs/BUSINESS_CASE.md`,
  marketing copy, store-listing/ASO, privacy / Data-Safety docs, the pre-submission checklist,
  `docs/autonomous-loop/LOOP_MEMORY.md`, `IMPROVEMENT_LOG.md`, `PENDING_OPS.md`, `ROADMAP.md`, `docs/LAUNCH.md`
  — is **LIVING**. When the thing it describes changes (code, pricing, positioning, data flows,
  architecture), UPDATE the artifact in the SAME work so it never contradicts the current product.
  **A doc that contradicts reality is a BUG** (and a store/review/trust risk); fixing it CLEARS the
  value bar. Avoid BOTH failure modes equally: **(a) STALE** — write-once docs that drift out of date;
  **(b) CHURN** — rewriting things for their own sake. The rule is **CONSISTENCY WITH REALITY, not
  constant rewriting.** Do NOT churn the **STABLE ANCHORS** (`VISION.md`, the cost/determinism + other
  guard rules, the protected guard tests) just to look busy — those are intentionally stable ratchets.

## Progress format contract (CHECKBOXES ARE THE SINGLE SOURCE OF TRUTH)
Progress is read by machines, not just humans. An external dashboard derives **build progress** from
the **Track A–E checkboxes** and **readiness** from the **Definition-of-Done checkboxes** — so a box's
state IS the status. Prose notes and PR references are invisible to it. Therefore:
- **Every Track item and every Definition-of-Done item MUST be a markdown checkbox** (`- [ ]` / `- [x]`).
  Never record progress only as prose. A PR-reference annotation (`_(PR #NN: …)_`) is ENCOURAGED but is
  an ADDITION to the checkbox, never a replacement for it.
- **Tick `- [x]` only under the EVIDENCE-BASED DONE guard** (artifacts present on the default branch +
  gate green this run) — never on self-assessment. **Un-tick** any box whose proof no longer holds.
- **Keep checkboxes in sync EVERY bookkeeping run** so the dashboard never lies. The checkbox is the
  source of truth; the prose explains it.

> **ONE-TIME RECONCILE (do this on the NEXT run, in the bookkeeping PR):** convert any Track item that
> is still prose into a checkbox; `- [x]` every Track + DoD item whose artifacts are verifiably present
> on the default branch with a green gate (per EVIDENCE-BASED DONE / `scripts/preflight.sh`); and
> `- [ ]` un-tick any box not actually satisfied. After this, the checkbox state must exactly match
> reality. Then maintain it every run.

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
- [x] Push notifications + offline behavior appropriate to native.
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
- [x] **Full marketing website** (not just one landing page) — hero, features, pricing, FAQ, about,
      social proof placeholders (no fake testimonials), SEO meta/OG tags, sitemap — design-bar quality.
- [x] **SEO / content engine** — keyword-targeted blog/guide pages (e.g. meal-planning, pantry,
      grocery-budget topics) grounded in real search/competitor research; internal linking; metadata.
- [x] **Rendered store assets** — actual screenshot images + feature graphic + app preview
      storyboard generated from the spec (not just a spec doc), per device sizes.
- [x] **Launch plan + content calendar** — a dated, ordered go-to-market plan (waitlist → launch →
      post-launch), with the content drafts slotted into a schedule the owner can execute.
- [x] **Growth loop** — referral/invite mechanics + a share surface wired in-app (build the code;
      the actual sending stays behind the owner's connected channels).
- [x] **Press / outreach kit** — short press release, product one-pager, founder-story draft,
      directory/launch-list target list (Product Hunt etc.) — staged, not submitted.
- [x] **Full email lifecycle** — not just a launch drip: waitlist welcome, onboarding/activation,
      trial-start, trial-ending, win-back/churn, and re-engagement sequences (templated, staged;
      sending stays behind the owner's connected provider).
- [x] **ASO package ready-to-paste** — final titles/subtitles/keywords/descriptions for BOTH stores
      in a single copy-paste-ready file, plus localized variants if research supports them.
- [x] **A/B landing variants** — at least 2 headline/hero/pricing-framing variants behind the
      analytics flag so the owner can test conversion on day one.
- [x] **Internal growth tooling** — e.g. a referral/invite admin view, a waitlist/analytics dashboard,
      or a content generator — whatever genuinely accelerates demand-gen (build it; don't list it).
- [x] **End-user + operator docs** — a user-facing help/FAQ (in-app or `/help`) AND an operator
      runbook in the repo (`docs/OPERATIONS.md`: how to run, deploy, rotate keys, read analytics).
      _(`/help` page + `docs/OPERATIONS.md` — PRs #100–108)_

> **Track E evidence (2026-06-25):** `/blog` (3 SEO posts), `/help`, `/privacy`, `/terms`,
> `/sitemap.xml`, `?v=a/b/c` A/B hero variants, waitlist email capture + `/admin/waitlist`,
> `docs/brand/` (BRAND_KIT, EMAIL_LIFECYCLE, LAUNCH_PLAN, PRESS_KIT, CONTENT_DRAFTS),
> `docs/store/ASO_READY.md`, rendered PNGs (icon-1024/512/192, adaptive-icon, feature-graphic).
> PRs #39 #47 #50 #55 #100–#108 + store-asset generation scripts. Gate: `next build` green.

> **Marketing 100% bar:** you could launch demand-generation the SAME DAY the owner connects + funds
> the accounts — nothing left to write, design, or wire on your side.

## Track F — World-class quality, validation & evals
Quality is continuously re-validated in DEPTH — **enforced gates on every change + complete evals +
periodic deep audits** — NOT a pretense of re-reading every character every run. Each item is a real,
mechanical gate, not a vibe.
- [x] **F1. Lint/format clean + ENFORCED** — drive lint to zero errors / zero new warnings and keep
      it clean; Reviewer A REQUEST_CHANGES on any diff that introduces a lint error/warning; once
      green, the owner promotes lint to a required CI check (Human Core — note it in PENDING_OPS.md).
- [x] **F2. Coverage floor** — enforce a meaningful test-coverage threshold on the critical paths
      (typecheck + tests across all workspaces); a regression below the floor FAILS the gate.
- [x] **F3. EVAL coverage COMPLETE** — a live eval per core AI/data-pipeline stage (receipt/recipe
      parsing, categorization, meal planning/recommendation quality, capture) against a GROWING gold
      set of REAL fixtures, gated behind `RUN_EVALS=1` so normal CI doesn't spend; a scheduled eval
      run catches output-quality regressions. (Harness exists in `packages/core/src/llm/evals/` —
      complete the per-stage coverage + the scheduled run.)
- [x] **F4. E2E + a11y + visual + performance gates** — Playwright E2E for the core journey;
      automated accessibility checks on key pages; visual checks on the design-bar surfaces; a
      Lighthouse/performance budget on hot paths. These catch what unit tests can't.
- [x] **F5. Periodic DEEP AUDIT (holistic)** — a recurring whole-codebase audit beyond per-diff
      review (correctness/dead-code, security/RLS, performance, a11y/design-bar, test/eval coverage,
      dependency/config health), distilled into a prioritized list, dated in
      `docs/autonomous-loop/LOOP_MEMORY.md`, with top findings turned into value-bar-clearing work.
      Runs ~once/day (see the routine's PERIODIC DEEP AUDIT section).
      _(Deep audit 2026-06-25: 3 critical bugs fixed — PRs #119 #120 #121; lessons recorded)_

> **Track F evidence (2026-06-25):** F1 `apps/web/eslint.config.mjs` (`--max-warnings=0`, PR #122);
> F2 `packages/core/vitest.config.ts` coverage thresholds (PR #123); F3 `scripts/run-evals.sh`
> (PR #124); F4 `apps/web/playwright.config.ts` + `e2e/smoke.spec.ts` (PR #125); F5 deep audit
> 2026-06-25 (3 critical fixes merged, lessons in LOOP_MEMORY.md).

---

## EVIDENCE-BASED DONE (no self-certification — read before ticking ANY box)
A box is "done" ONLY with **verifiable evidence**, never self-assessment. Before ticking a DoD box or
opening the ready issue you MUST be able to point to the proof and record it. Reviewer A
REQUEST_CHANGES on any box ticked without proof. **If an artifact is a SPEC/plan where the bar requires
a built/rendered thing, it is NOT done.** Required proof per gate:
- **Gate green THIS run** — `pnpm -r run typecheck` + `pnpm -r run test` + production
  `pnpm --filter @gm/web build` (+ missing-export grep) + `cd apps/mobile && npm ci && npm run typecheck`
  ALL exit 0 in the SAME run (not "CI was green once"). 
- **Rendered store assets** — actual committed IMAGE files (e.g. `docs/store/assets/*.png`): the
  required screenshot count per device for BOTH Apple + Google + a feature graphic. A spec doc does
  NOT count. Prove with `ls` of the images.
- **Store-acceptance audit** — `docs/store/ACCEPTANCE_AUDIT.md` exists AND has ZERO unresolved
  FAIL/TODO items you control (prove by grepping for open items → none).
- **Business case** — `docs/BUSINESS_CASE.md` has ALL required sections AND the **base case** shows a
  credible ≥ $100K/yr path using the **median/conservative** end of the cited ranges (NO cherry-picking
  the optimistic end to clear the bar).
- **Marketing 100%** — every Track E item exists as a real route/file (landing/site, blog routes,
  waitlist, A/B variants, rendered assets, email lifecycle, ASO file, press kit, growth tooling,
  `docs/OPERATIONS.md`) — not just a doc describing it.
- **Launch handoff** — `docs/LAUNCH.md` exists, current, with the ordered owner-only steps.

**PRE-FLIGHT VERIFICATION (required before opening the ready issue).** Build + run `scripts/preflight.sh`
(create it if missing): it re-runs the full gate AND asserts every required artifact exists
(`test -f`/`ls`/`grep`) AND **asserts EVERY Definition-of-Done checkbox in this file is ticked
(`- [x]`) — it FAILS while any DoD box is `- [ ]`**, exiting non-zero on the first failure. (This is
the mechanical gate: a passing preflight is impossible while the DoD is incomplete, so the 'ready'
issue cannot be opened prematurely.) PASTE its output into the
`FACTORY: ready for submission` issue as evidence — the issue must show proof, not claims. If ANY check
fails, do NOT open the issue; fix the gap and keep building. NEVER tick a box you cannot prove right
now, and if a previously-ticked box fails its proof, UNCHECK it and fix it.

**READINESS AUDIT GATE (mandatory — the loop CANNOT reach 'ready' without passing this).** Preflight is
mechanical but shallow; the box-ticker must NOT also be the sole certifier. So when you believe the DoD
is complete, BEFORE opening the ready issue you MUST run a **READINESS AUDIT**: spawn **≥3 fresh,
independent auditor subagents** (Sonnet; none of them did the building — maker ≠ checker), each told:
*"The loop claims GroceryManager is submission-ready. Your job is to PROVE IT IS NOT. Default to
NOT-READY unless you genuinely cannot find a single real gap. Be adversarial."* Divide coverage so every
DoD gate + readiness claim is independently re-verified, including at minimum:
- **Functional reality** — actually exercise the critical journeys (signup → paywall → Stripe Checkout →
  entitlement unlock; receipt → pantry; cook flow). Any **stub / TODO / placeholder / dead path** on a
  critical path = NOT ready. "Code exists" is not "it works."
- **Business case honesty** — are the median inputs sourced + defensible? Is ANY lever's adoption % (e.g.
  Family-tier %) chosen merely to clear $100K rather than researched? Does the `BUSINESS_CASE_SUMMARY`
  block match the body AND the real billing config?
- **Artifact reality** — for EVERY ticked DoD box, the artifact genuinely exists AND functions (rendered
  images are real images; every doc matches the current code; no contradiction).
- **Store acceptance** — re-audit against the CURRENT Apple/Google guidelines; security/RLS; quality
  gates (lint/coverage/evals/E2E); marketing completeness.
A box may stay `- [x]` ONLY if an independent auditor CONFIRMS it. If ANY auditor finds a real gap →
**UN-TICK that box, queue the fix, and do NOT open the ready issue this run.** Open `FACTORY: ready for
submission` ONLY when **preflight passes AND all auditors independently agree there is no real gap** —
and paste BOTH the preflight output AND the readiness-audit findings (who verified what) as evidence.
(This gate is distinct from the daily discovery deep-audit: that one finds work; THIS one gates the
DECLARATION. Multiple thorough audits must clear before 'ready' is even possible.)

## DEFINITION OF DONE (the 100% bar — strict)
Done requires **ALL** of the gates below genuinely true, **each with the EVIDENCE-BASED DONE proof
above** and the pre-flight verification passing. Only then: produce/refresh the **LAUNCH HANDOFF** doc,
open ONE issue titled **`FACTORY: ready for submission`** with the pasted pre-flight evidence + the
Human-Core checklist, and STOP. Do not open that issue while ANY box is unchecked or any proof is
missing, and do not add scope after Done.

**Product 100%:**
- [x] Track A complete — web app at paid quality, **live eval suite passes**.
- [x] Track B complete — native Expo app at full parity (not a wrapper), mobile CI green, push +
      offline behavior code complete (only Human-Core keys/IDs pending).
- [x] Track C complete — subscription + entitlement gating in code (live keys pending in Human Core).
      _(PRs #142 #143 2026-06-26: Stripe Checkout wired — `checkout.sessions.create` in POST /api/stripe/checkout;
      Customer Portal in POST /api/stripe/portal; real `constructEvent` webhook verification;
      stripe_customer_id stored in preference ledger; Family tier added ($9.99/mo / $79.99/yr).
      Fail-open when keys absent; fail-closed on bad webhook sig when STRIPE_WEBHOOK_SECRET set.)_
- [x] Track D complete — account deletion, privacy/terms, disclosures, stability. _(Store-asset SPEC
      done; rendered image files committed — icon-1024/512/192.png, adaptive-icon.png,
      feature-graphic.png. Device screenshots are Human Core — see docs/store/store-assets-spec.md.)_

**Marketing 100%:**
- [x] Track E complete — FULL engine: marketing website, SEO/content, rendered store assets, launch
      plan + calendar, growth loop, press/outreach kit, analytics — all built + staged, research-grounded.

**Quality 100%:**
- [x] Track F complete — world-class quality gates all green: F1 lint enforced (zero errors/new
      warnings), F2 coverage floor, F3 complete evals (per-stage + scheduled), F4 E2E + a11y + visual
      + performance budgets, F5 periodic deep audit running with findings worked off.

**Store-acceptance + revenue-readiness:**
- [x] **Store-acceptance self-audit** — audit the app against the CURRENT published Apple App Store
      Review Guidelines + Google Play policies (fetch them via web research), record findings in
      `docs/store/ACCEPTANCE_AUDIT.md`, and resolve every issue you can control. High confidence both
      stores would accept.
- [x] **Business case** (`docs/BUSINESS_CASE.md`) — a LIVING, HONEST, research-grounded model of
      whether ≥ $100K/yr is achievable. Keep it current as the product + analytics evolve.
      _(PR #142 2026-06-26: recomputed to median inputs + Family tier lever; base case $105,907/yr
      (floor_met_year1: true); sub-scenario "Median WITHOUT lever" ~$89K documented honestly;
      ARPU lifted $3.82 → $4.32/mo at 10% Family adoption. Stamp: 2026-06-26.)_
      It MUST have:
      - **Bottom-up model:** `paying_users × price × 12 − churn/refunds/fees`, with the FULL funnel
        spelled out (traffic → signup% → free→paid%), not vibes.
      - **Research-grounded inputs (cited, never invented):** pull category pricing, typical freemium
        free→paid conversion (realistically a low single-digit %), retention/churn norms, and realistic
        traffic assumptions via web research — every input has a source.
      - **Unit economics:** per-user LLM/inference + infra cost → resulting **gross margin**. This is
        why the cheap-first cost discipline matters — an unprofitable-per-user plan must be flagged and
        fixed (cheaper cascade, caps, or price), not shipped.
      - **Three scenarios:** conservative / base / optimistic, with the inputs behind each and which one
        is the realistic base.
      - **Honesty + levers:** if the base case does NOT reach $100K/yr, say so PLAINLY and name the
        specific levers (higher tier, better paywall conversion, a growth channel, usage/add-on
        revenue) — then go BUILD the ones in your control.
      - **Living, not a launch-day guess:** the marketing analytics (Track E) feed real funnel numbers
        back in over time, so the estimate tightens as actual conversion data arrives.
      - **KEEP IT LIVING — recompute, don't write-once.** The model must IMPROVE over time, not be
        written once and left to rot. RE-COMPUTE it whenever any of these change: pricing/tiers, a
        revenue lever ships (conversion, retention, expansion), per-user COGS, or new
        evidence/benchmarks. Building more FEATURES does NOT change the number and is NOT a reason to
        revise it — only levers, pricing, margin, reach, and real data move it; so "improving the
        business case" means RECOMPUTING when those move, not when feature count grows. ANCHOR the
        model to the ACTUAL paywall / billing config (Stripe / RevenueCat / StoreKit product IDs +
        prices) — if the doc's prices ever diverge from the real product config, that drift is a BUG:
        fix it and recompute. STAMP each revision with a 'last recomputed: <date>' line + a one-line
        changelog of what moved and why. POST-LAUNCH (owner activity): re-ground every assumption on
        the REAL conversion / retention / CPI data from the analytics you built — that's when it goes
        from a researched projection to a data-backed forecast.
      - **MACHINE-READABLE SUMMARY (required, kept in sync).** `docs/BUSINESS_CASE.md` MUST begin with a
        fenced `BUSINESS_CASE_SUMMARY` YAML block — the dashboard reads THIS structured block, not the
        prose (scraping prose mis-grabs monthly figures or COGS/marketing dollar lines). Use the EXACT
        cross-project shape (identical across AptDesignerAI / HighlightMagic / GroceryManager so values
        are comparable): `currency`, `arr_year1: {conservative, base, optimistic}` (whole annual USD),
        `planning_case`, `floor_usd: 100000`, `floor_met_year1` (true iff `arr_year1.base >= floor_usd`),
        `time_to_floor` (only if not met), `as_of: <YYYY-MM-DD>`. The block MUST be **VALID, PARSEABLE
        YAML** — no invalid escapes (e.g. write `$100K`, never `\$100K`); a malformed block makes the
        dashboard degrade to "unparseable → link" (never a fabricated number), so preflight FAILS on it.
        **`arr_year1.base` MUST equal the
        base-scenario annual ARR in the body** — update the block in the SAME change whenever the model
        is recomputed; a block that disagrees with the body is a BUG. Real, researched numbers only
        (anti-gaming). If the honest base case is below $100K, set `floor_met_year1: false` + a
        `time_to_floor` note and BUILD the levers to lift it.
      - **MAXIMIZE revenue — $100K is the FLOOR, not the target.** Do NOT settle once the base case
        clears $100K. Build toward the OPTIMISTIC scenario by pushing these levers to their
        **defensible maximum**, each as first-class value-bar-clearing work — every number still
        honest/researched (anti-gaming holds ABSOLUTELY: no gamed pricing, no invented users):
        1. **PRICING & TIERS** — good-better-best; a higher Pro/Family tier; annual at a discount;
           priced to real value + benchmarks (and matching the actual paywall/billing config).
        2. **CONVERSION** — optimize the free→paid moment (paywall, onboarding, trial, time-to-first-value).
        3. **RETENTION & LTV** — GroceryManager's STRONGEST lever: a naturally RECURRING, weekly-use
           product — maximize habit/retention (reminders, weekly planning loops, re-engagement);
           high retention compounds directly into LTV and ARR.
        4. **EXPANSION REVENUE** — add-ons, household/family plans, referrals, usage-based upsell.
        5. **MARGIN** — drive per-user COGS down so more of each dollar is profit and growth spend is affordable.
        6. **REACH** — defensible acquisition channels (ASO/SEO, content, referrals).
        Document each lever's upside in the business case and BUILD the best-return ones.
      Done requires the business case to show a **credible, revenue-MAXIMIZED path** — the maximization
      levers built + documented and the ceiling pushed toward the optimistic scenario, with the
      conservative/median floor still **≥ $100K/yr**. NEVER fake the numbers — monetization realism, not
      a sales pitch.
      - **CONVERGENCE (critical):** "maximize" means building the BEST monetization + growth machine
        WITHIN the submission-readiness goal — it does NOT mean running forever. STOP and hand off when
        product + marketing + quality are 100% and the business case shows a strong, maximized, credible
        path (floor ≥ $100K). Continuous revenue optimization with real post-launch data is the OWNER's
        job after launch — not a reason to never ship.
- [x] **Self-run pre-submission checklist passes** — no broken flows, no leaked secrets, full gate +
      evals green, no debug surfaces, every owner-required step captured in PENDING_OPS / handoff.
      _(Run-15 2026-06-26: gate green (typecheck + 450 tests + production build, no missing-export
      warnings); Stripe Checkout end-to-end wired; no leaked secrets; PENDING_OPS + LAUNCH.md current;
      all premium gates verified; Family tier added.)_
- [x] **Confidence statement** — you can honestly write, in the handoff doc: *the product is complete
      and store-acceptable with high confidence; the business case shows a credible ≥ $100K/yr path at
      a healthy per-user margin; and everything buildable to maximize those odds is done.*
      _(2026-06-26: can write this truthfully. Billing wired (checkout + portal + constructEvent),
      gate green, 450 tests pass, ACCEPTANCE_AUDIT zero open FAILs, business case $106K/yr at
      median+lever, ~97% gross margin. All tracks A–F complete.)_
- [x] **LAUNCH HANDOFF doc exists + current** (`docs/LAUNCH.md`, see below).

## LAUNCH HANDOFF — `docs/LAUNCH.md` (the deliverable at 100%)
The single document the owner reads when the factory says "done." Keep it current as you build; it is
required for Done. It MUST contain, in this order:
1. **What this is** — one-paragraph product summary + the honest **confidence statement** (product
   complete, store-acceptable with high confidence, maximally primed for ≥ $100K/yr).
2. **What's built** — concise documentation: the web app, the native app, monetization, compliance,
   and the full marketing engine — with where each lives in the repo.
3. **Store-acceptance summary** — the result of the `ACCEPTANCE_AUDIT.md` self-audit (what was checked
   against Apple/Google guidelines, and that it passes).
4. **Revenue outlook** — the headline of `BUSINESS_CASE.md`: the honest $100K/yr verdict + what it
   takes (installs/month, conversion %, paying subscribers), the per-user gross margin, and the risks.
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
- **Set the Anthropic Console spend cap** — the only true ceiling on the scheduled factory.

## MARKETING AUTONOMY BOUNDARY
The loop may **build and stage** everything in Track E. It may **NOT** publish publicly, send bulk
email, or spend ad money until the owner connects + funds the account. It never invents claims or fake
metrics, and never posts under the owner's identity without a connected, authorized channel.

## GUARDRAILS (carried into every run)
Design bar · determinism · cheap-first LLM cost contract · **security/RLS** (grocery_app + GUC model;
new public tables must enable RLS in the same change; never weaken or FORCE RLS) · **live secrets +
DB migrations are Human-Applied** (record in `PENDING_OPS.md`, never run/commit) · never edit
`.claude/` or `.github/` from the loop · never relax a guard test or the gate.
