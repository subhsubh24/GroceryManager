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

## Authed journeys — `journeys.spec.ts` (outcome-asserting; self-seeds via real signup)
| Flow / route | Asserted INTENDED outcome |
|---|---|
| **signup → onboarding** | new account redirects into `/onboarding` (not /signup, not error) |
| **signup → dashboard** | `/` renders the real dashboard (sign-out control + "Getting started"); **never** the "Couldn't load your dashboard" error boundary — *the exact break that "compiles + passes" hid* |
| **primary nav** | `/`, `/pantry`, `/list`, `/recipes`, `/plan`, `/discover`, `/profile` each render their real screen — not the error boundary, not a bounce to /signin |
| **paywall** | `/upgrade` renders a real price (`$…`) + upgrade affordance |
| **settings** | `/profile` renders for the user |
| **auth boundary** | logged-out `/` shows sign-in (no signed-in control); a protected route (`/pantry`) bounces a logged-out visitor to `/signin` |

## Gaps to close next (add outcome-asserting tests; tracked so coverage stays provably complete)
- Core product loop end-to-end: add-receipt/scan → pantry populated → cook flow → list/reorder updates.
- Paywall → Stripe Checkout (TEST MODE) → entitlement unlock reflected in the UI.
- Real empty / loading / error states per surface (assert the *intended* empty copy, not a blank).
- Onboarding completion → dashboard (the multi-step flow itself, not just the redirect target).

## Human-only — CANNOT run headlessly → `PENDING_OPS.md` "must be manually verified" (never assumed)
- Real payment **capture** (live Stripe charge), refunds, webhook delivery from Stripe's servers.
- Email **deliverability** (provider actually sends + inbox placement).
- Native **store purchases** (StoreKit / Play Billing on a real device).
- Push-notification delivery to a real device.

> Coverage is "complete" only when every row above (public + authed + the gaps) has an outcome-asserting
> runtime test that has actually RUN green, and the human-only items are checked off on the deployed env.
