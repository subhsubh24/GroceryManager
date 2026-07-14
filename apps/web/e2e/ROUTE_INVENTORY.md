# E2E Route / Flow Inventory — provable functional coverage

**BUILDS ≠ WORKS.** Every route and every user flow must be validated at RUNTIME, as a user, asserting
the INTENDED OUTCOME — not just that it compiles or returns `<400`. This inventory makes coverage
*provable*: each surface lists the spec that exercises it and the outcome it asserts. A surface with no
outcome-asserting runtime test is a coverage GAP (treat as NOT ready), not "probably fine."

Run (server must be up against a migrated DB; captcha fails open when the Turnstile key is unset):
```
DATABASE_URL=postgres://… pnpm --filter web dev      # or a built `start`
BASE_URL=http://localhost:3000 pnpm --filter @gm/web e2e
```

## Public surfaces — `smoke.spec.ts`
| Route | Asserted outcome |
|---|---|
| `/` (logged-out) | marketing hero renders; title matches |
| `/signin` | username/password field visible |
| `/signup` | form renders, does NOT bounce to /signin |
| `/blog`, `/help`, `/privacy`, `/terms` | render without auth |
| `/sitemap.xml`, `/robots.txt` | crawlable (in PUBLIC allowlist) |

## §44 Layer A — DETERMINISTIC LIVE-PROD smoke — `prod-smoke.spec.ts`
Deterministic (no LLM / no browser-agent) health re-probe of the DEPLOYED app, run against `BASE_URL`
(localhost by default, the LIVE prod URL when the owner-wired post-deploy / scheduled job overrides it),
at **mobile (390×844) AND desktop (1366×900)**. It catches the class of failure that passes green CI and
only breaks on the live URL: hydration mismatches (#418/#425), an empty `<title>`, a broken first paint,
a same-origin 5xx or failed critical-path request. For every no-account critical route it asserts:

| Route tier | Routes | Asserted outcome |
|---|---|---|
| gate-EXEMPT marketing/legal/demo (`SITE_GATE_EXEMPT`) | `/`, `/demo`, `/blog`, `/help`, `/privacy`, `/terms` | HTTP **200**; non-empty `<title>`; body painted; ZERO hydration errors; ZERO uncaught page errors; ZERO console errors (cosmetic asset / third-party noise filtered); no failed critical-path network request; a screenshot artifact captured |
| gate-sensitive auth surface | `/signin`, `/signup` | status ∈ {**200** gate-off/post-launch, **401** pre-launch site-gate challenge — a 401 that is NOT the recognizable `Private pre-launch` gate FAILS}; plus every health assertion above |

Run it: `BASE_URL=https://<prod-url> pnpm --filter @gm/web e2e prod-smoke`. NOT in the CI `e2e` job's
filter (that job runs `journeys` + `email-roundtrip` against a throwaway DB) — this is the target of the
owner-wired LIVE-PROD job (needs `PROD_URL`; see PENDING_OPS.md). Authed prod journeys need a dedicated
throwaway prod test account (an OWNER_ACTION — the loop never fabricates credentials) → §44 Layer B.
Screenshots land in `__screenshots__/prod-smoke/` for the Layer B vision pass.

## Authed journeys — `journeys.spec.ts` (outcome-asserting; self-seeds via real signup)
| Flow / route | Asserted INTENDED outcome |
|---|---|
| **signup → onboarding** | new account redirects into `/onboarding` (not /signup, not error) |
| **signup → dashboard** | `/` renders the real dashboard (sign-out control + "Getting started"); **never** the "Couldn't load your dashboard" error boundary — *the exact break that "compiles + passes" hid* |
| **returning sign-IN** | a returning user signs in through the real `/signin` form (next-auth credentials → real DB) and lands on the working dashboard; on failure the test surfaces the auth-error banner + console/page errors (evidence, not a blind timeout) — covers the LaunchGuard re-login path distinct from signup |
| **onboarding step-through** | STEPS THROUGH every macro step (Profile → Taste → Items → Done) to the working dashboard — a step that dead-ends or LOOPS never leaves `/onboarding` and fails loud. The e2e job sets a dummy `GEMINI_API_KEY` so the AI taste path renders + its fail-degrade is exercised (the taste-loop bug this catches) |
| **primary nav** | `/`, `/pantry`, `/list`, `/recipes`, `/plan`, `/discover`, `/profile` each render their real screen — not the error boundary, not a bounce to /signin |
| **paywall** | `/upgrade` renders a real price (`$…`) + upgrade affordance |
| **settings** | `/profile` renders for the user |
| **auth boundary** | logged-out `/` shows sign-in (no signed-in control); a protected route (`/pantry`) bounces a logged-out visitor to `/signin` |

## Gaps to close next (add outcome-asserting tests; tracked so coverage stays provably complete)
- Core product loop end-to-end: add-receipt/scan → pantry populated → cook flow → list/reorder updates.
- Paywall → Stripe Checkout (TEST MODE) → entitlement unlock reflected in the UI.
- Real empty / loading / error states per surface (assert the *intended* empty copy, not a blank).
- Onboarding completion → dashboard (the multi-step flow itself, not just the redirect target).

## Visual-verification artifacts — `screenshots.spec.ts` (ROADMAP F6)
Real, committed, non-zero PNGs of the core surfaces + the core-product OUTPUT, captured BY the suite
through the REAL app flow (a fresh account signs up, then SEEDS its pantry via the keyless
`addPantryItemAction` form — no LLM key required — so the pantry/dashboard show the genuine produced
artifact, not an empty placeholder). Each is captured at **mobile (390×844)** and **desktop (1366×900)**
into `apps/web/e2e/__screenshots__/` (`<name>-mobile.png` / `<name>-desktop.png`). The committed images
get a per-screenshot **DUAL-AXIS** verdict (FUNCTIONAL + DESIGN) recorded in
`docs/autonomous-loop/LOOP_MEMORY.md` (deep audit) + the readiness-issue evidence — capture-and-forget
does NOT satisfy F6.

| Artifact | Surface / state captured |
|---|---|
| `01-marketing-home` | logged-out marketing landing (hero, features, pricing, waitlist) |
| `02-signup` | signup form |
| `03-onboarding-profile` | first-run onboarding (step 1 of 4) |
| `04-pantry-populated` | **core-product output** — a POPULATED pantry with real run-out predictions |
| `05-dashboard` | the activation dashboard (real "5 items tracked" + getting-started checklist) |
| `06-list` | reorder / shopping list |
| `07-recipes` | cook-tonight (effort + diet chips) |
| `08-plan` | plan-my-week |
| `09-discover` | discover feed |
| `10-profile` | account/settings (incl. account-deletion danger zone) |
| `11-upgrade-paywall` | **monetization surface** — real $4.99 / $39.99 pricing |

> Regenerate: build + `start` the app against a migrated, seeded DB, then
> `BASE_URL=http://localhost:3000 pnpm --filter @gm/web e2e screenshots`.

## Human-only — CANNOT run headlessly → `PENDING_OPS.md` "must be manually verified" (never assumed)
- Real payment **capture** (live Stripe charge), refunds, webhook delivery from Stripe's servers.
- Email **deliverability** (provider actually sends + inbox placement).
- Native **store purchases** (StoreKit / Play Billing on a real device).
- Push-notification delivery to a real device.

> Coverage is "complete" only when every row above (public + authed + the gaps) has an outcome-asserting
> runtime test that has actually RUN green, and the human-only items are checked off on the deployed env.
