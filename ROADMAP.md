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
- [ ] **Security/RLS** — every public table RLS-protected (see Security bar below). _Catalog-table
      RLS shipped 2026-06-23 (0010); function `search_path` warnings still open._
- [ ] **EVAL COVERAGE (first-class)** — grow the live `RUN_EVALS`-gated suites
      (`packages/core/src/llm/evals/*.eval.test.ts`) to cover every core LLM stage (receipt
      extraction, recipe import, remix, meal-gen, capture) with **real** golden fixtures, pass-rate
      floors, and the ratchet. _Harness exists; grow the gold set._

## Track B — Native Expo mobile app (`apps/mobile`) — FULL PARITY
A **real** app reusing `@gm/core` engines — NOT a thin WebView wrapper (Apple 4.2). Target **full
feature parity with `apps/web`** before submission (owner decision, locked).
- [ ] Initialize Expo / expo-router in `apps/mobile` (deps + `tsconfig.json` + `typecheck` script);
      keep it out of the root `pnpm install` if that protects web CI, but make it independently
      installable + typecheckable (the `mobile` CI job enforces once this exists).
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
- [ ] Subscription model: **monthly + annual + 7-day free trial**, with server-side **entitlement
      gating** of the premium power tier (never trust the client; core loop stays free).
- [ ] Define the FREE vs PREMIUM feature split in code (the candidate premium set in Product
      decisions) — gate real value, never core utility.
- [ ] RevenueCat (mobile) / Stripe (web) integration **code** — keys read from env, **never
      committed**; webhook handlers + entitlement sync; entitlement shared across web + mobile.
- [ ] Clear paywall + manage-subscription UX within the design bar (web `/upgrade` + native paywall).
- [ ] All live keys / product IDs / prices / go-live config recorded in `PENDING_OPS.md` as **Human
      Core** — never applied by the loop. Billing/auth diffs get extra reviewer scrutiny for leaked
      secrets + trust-the-client entitlement bugs.

## Track D — Store readiness & compliance
- [ ] **In-app account deletion** (Apple 5.1.1(v)) — full data erase path.
- [ ] **Privacy policy + terms** pages, linked in-app and in store metadata.
- [ ] **App Privacy (Apple) / Data Safety (Play)** disclosures drafted from actual data flows.
- [ ] Store assets staged (icon, screenshots, descriptions) — see Track E for copy.
- [ ] Stability pass — no crash-on-launch; offline/empty handled; no debug surfaces.

## Track E — Marketing engine (BUILD + STAGE only)
- [ ] **Brand naming** — propose 2–3 name candidates (name + logo direction + voice) for the owner
      to pick; until chosen, ship under "GroceryManager". Chosen name propagates to app + store metadata.
- [ ] Waitlist / landing page (the public marketing surface) with email capture (staged, not sent) —
      drives pre-launch demand so there's an audience to convert on store launch.
- [ ] Brand kit (logo, palette, type, voice) consistent with the app + the chosen name.
- [ ] ASO / store copy (title, subtitle, keywords, description) drafted.
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
