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

## Track B — Native Expo mobile app (`apps/mobile`)
A **real** app reusing `@gm/core` engines — NOT a thin WebView wrapper (Apple 4.2).
- [ ] Initialize Expo / expo-router in `apps/mobile` (deps + `tsconfig.json` + `typecheck` script);
      keep it out of the root `pnpm install` if that protects web CI, but make it independently
      installable + typecheckable (the `mobile` CI job enforces once this exists).
- [ ] Core native screens reusing `@gm/core` (pantry, cook, list, capture/scan) — native UX, not an
      iframe. Auth + tenant context wired to the same backend.
- [ ] Mobile gate green in CI (the graceful-skip `mobile` job starts enforcing once initialized).
- [ ] EAS build config staged (credentials are Human Core).

## Track C — Monetization (subscription)
Scaffold exists: `@gm/core/billing` + `/upgrade` behind `FEATURE_BILLING` (fail-open, no live keys).
- [ ] Subscription model: **monthly + annual + free trial**, with server-side **entitlement gating**
      of premium features (never trust the client).
- [ ] RevenueCat (mobile) / Stripe (web) integration **code** — keys read from env, **never
      committed**; webhook handlers + entitlement sync.
- [ ] Clear paywall + manage-subscription UX within the design bar.
- [ ] All live keys / go-live config recorded in `PENDING_OPS.md` as **Human Core** — never applied
      by the loop. Billing/auth diffs get extra reviewer scrutiny for leaked secrets + trust-the-client.

## Track D — Store readiness & compliance
- [ ] **In-app account deletion** (Apple 5.1.1(v)) — full data erase path.
- [ ] **Privacy policy + terms** pages, linked in-app and in store metadata.
- [ ] **App Privacy (Apple) / Data Safety (Play)** disclosures drafted from actual data flows.
- [ ] Store assets staged (icon, screenshots, descriptions) — see Track E for copy.
- [ ] Stability pass — no crash-on-launch; offline/empty handled; no debug surfaces.

## Track E — Marketing engine (BUILD + STAGE only)
- [ ] Waitlist / landing page (the public marketing surface) with email capture (staged, not sent).
- [ ] Brand kit (logo, palette, type, voice) consistent with the app.
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
