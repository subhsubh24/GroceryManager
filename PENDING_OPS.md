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
  as_of: "2026-07-11 (GTM run 11) — RE-VERIFIED, unchanged on Human-Core items: a fresh authenticated snapshot
    pull returned a payload identical in substance to runs 8-10 (all 4 sources still connected, funnel still
    0/null); site gate still up (/demo + /join still live and gate-exempt). Zero movement on the open
    Human-Core items below (eas-build-submit-go-live, connect-revenuecat-iap, spend-caps, turnstile-keys,
    rotate-envl-secrets) since run 8 — see docs/growth/GROWTH_STATUS.md + GROWTH_MEMORY.md run 11 for full
    detail. NOTE: QUALITY_SCORECARD (independent, product-loop-owned) regressed this window (overall A->B,
    ship_gate_met false — a mobile icon-system gap) but that is Product-Factory build work, not a new
    Human-Core item, so it is NOT added here. NEW this window (added by GTM run 11, not Human-Core, optional):
    `gtm-content-validation-kit-v1` — see that item below."
  items:
    - id: gtm-connect-waitlist
      title: "DONE: waitlist source connected — the Growth Agent's own read need is satisfied via CRON_SECRET"
      priority: normal
      status: done
      resolved: "2026-07-04 (GTM run 8) — GET /api/growth/snapshot with Authorization: Bearer $CRON_SECRET
        returned HTTP 200 with a real DB-derived waitlist total (0), via getWaitlistSubmissions. This
        satisfies the routine's own fail-closed read requirement WITHOUT needing ADMIN_EMAIL. ADMIN_EMAIL
        remains open as a SEPARATE, lower-priority item purely for human /admin/waitlist UI access — see
        `waitlist-migration` below, downgraded to normal priority."
      why: "GTM_STANDARD §4 fail-closed rule — the Growth Agent cannot report a verified waitlist count until this source resolves to connected. RESOLVED: it now does, via the authenticated snapshot route."
      how: "No further action needed for the Growth Agent's own analytics. ADMIN_EMAIL (human UI convenience only) tracked separately in `waitlist-migration`."
      blocks: none
    - id: gtm-connect-analytics
      title: "DONE: analytics source connected (Plausible Stats API round-trip verified)"
      priority: normal
      status: done
      resolved: "2026-07-04 (GTM run 8) — the snapshot route's live Plausible Stats API call succeeded
        (not just a key-presence check) and returned a real visitors_7d value (0). Both
        NEXT_PUBLIC_PLAUSIBLE_DOMAIN (verified run 5) and PLAUSIBLE_API_KEY (new this run) are confirmed live."
      why: "GTM_STANDARD §4 fail-closed rule — the Growth Agent cannot report visitor/conversion-rate metrics until this source resolves to connected. RESOLVED."
      how: "No further action needed."
      blocks: none
    - id: gtm-connect-billing
      title: "DONE: billing source connected (Stripe key present + a real DB query for active subscribers succeeded)"
      priority: normal
      status: done
      resolved: "2026-07-04 (GTM run 8) — STRIPE_SECRET_KEY is present in the deployed app and
        getActiveSubscriberStats (real DB query) returned a genuine 0-active-subscriber count. NOTE:
        whether the key is Stripe TEST or LIVE mode is not observable externally — worth an owner
        confirmation before this feeds any revenue claim (currently moot at 0 subscribers)."
      why: "GTM_STANDARD §4 fail-closed rule — the Growth Agent cannot report MRR/churn/CAC until this source resolves to connected. RESOLVED."
      how: "No further action needed. Optional: confirm TEST vs LIVE mode with the Growth Agent's next run."
      blocks: none
    - id: gtm-connect-email
      title: "DONE (with a caveat): email provider key connected — deliverability itself still unconfirmed"
      priority: normal
      status: done
      resolved: "2026-07-04 (GTM run 8) — a supported provider key (RESEND_API_KEY / SENDGRID_API_KEY /
        POSTMARK_API_KEY) is present in the deployed app (emailConnected:true in the snapshot). CAVEAT:
        this is a key-presence check, not a live send — open_rate/click_rate stay null until a real
        send+open/click is observed, which won't happen until GTM_STANDARD §6's launch gate opens."
      why: "GTM_STANDARD §4 fail-closed rule — the Growth Agent cannot report open/click rates until this source resolves to connected. RESOLVED for connection status; deliverability remains a distinct, still-open question."
      how: "No further action needed to unblock GTM validation. Deliverability check happens naturally once real lifecycle sends occur post-launch."
      blocks: none
    - id: set-direct-database-url-prod
      title: "DONE: DIRECT_DATABASE_URL set in Vercel — signup/signin working in prod (19 users, 16 in last 7d, newest 2026-06-28)"
      priority: urgent
      status: done
      resolved: "2026-06-28 — verified via Supabase MCP: 19 users, 16 created in the last 7 days, most recent signup 2026-06-28 04:53. New user rows are being created, which is only possible when getAdminDb() has the owner connection — so DIRECT_DATABASE_URL is set. The outage chain is closed."
      why: "ROOT CAUSE of 'Couldn't load your dashboard' on signup/signin (proven against prod via the Supabase MCP). The `users` table has RLS enabled (policy `tenant_isolation: id = app_current_user_id()`, scoped to the `grocery_app` role); the table owner `postgres` bypasses RLS (FORCE RLS is off). `getAdminDb()` = createDb(DIRECT_DATABASE_URL ?? DATABASE_URL) and it does BOTH signup's user INSERT and signin's username lookup. DIRECT_DATABASE_URL is `.optional()`, so when it's unset in prod, getAdminDb silently falls back to the RLS-restricted DATABASE_URL (grocery_app) — which has no tenant session, so the users read/insert are DENIED. Result: signin + signup both fail and NO user row is ever created (verified: newest user stuck at 2026-06-23; a direct INSERT under an RLS-bypassing/owner connection succeeds). This is a deployment-config gap, not a code bug."
      how: "In Vercel project env, set DIRECT_DATABASE_URL to the Supabase OWNER connection (port 5432, role postgres) — Supabase dashboard → Connect → Session pooler. Format: postgres://postgres.ycvgsslzmzgoatwlniwf:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres (password + region from that panel; never commit it). Leave DATABASE_URL as-is (the grocery_app/pooler URL — that's what makes RLS work). Redeploy. Then a fresh signup creates a user and lands on the dashboard; existing accounts can sign in. (Same var that `pnpm db:migrate` uses for the direct connection.)"
      blocks: launch-functional
    - id: enable-db-pitr-backups
      title: "Supabase daily backups confirmed ON (Pro, 7-day retention) — recoverability net for auto-migrate"
      priority: high
      status: done
      why: "Auto-migrate-on-deploy (enable-auto-migrate-secret) removes the manual schema checkpoint — a migration that passes CI + the 2-reviewer/RLS review reaches prod with no human pause. The fresh-DB validation + review replace MOST of that safety, but a recoverability net is the backstop the manual step used to provide. Enable PITR/backups BEFORE turning on auto-migrate so any bad write is recoverable."
      how: "Supabase dashboard → Database → Backups: confirm daily backups are on (Pro plan) and/or enable Point-in-Time Recovery (PITR add-on) for the prod project. Then proceed with enable-auto-migrate-secret. Forward-only migrations + PITR = the conscious tradeoff for zero recurring `db push` work."
      blocks: none
    - id: enable-auto-migrate-secret
      title: "Add GitHub Actions secret PROD_DIRECT_DATABASE_URL → migrations then auto-apply on every deploy (one-time, kills schema drift)"
      priority: high
      status: done
      why: "Schema drift (the loop adds a migration, a human forgets to run it against prod) was the ROOT cause of the signup/onboarding outage. The CI `migrate-prod` job auto-applies the full chain to prod on every push to main — but ONLY after the build + fresh-DB migration validation pass, forward-only, and only once it has the prod owner connection as a secret. Without the secret it warns + skips (never blocks). All migrations 0011–0019 are ALREADY applied to prod (via MCP); this makes every FUTURE migration apply itself. TRADEOFF (apply consciously): this removes the human schema checkpoint — enable enable-db-pitr-backups FIRST as the recoverability net."
      how: "1) Do enable-db-pitr-backups first. 2) GitHub repo → Settings → Secrets and variables → Actions → New repository secret: name PROD_DIRECT_DATABASE_URL, value = the Supabase OWNER/DIRECT connection (Connect → Session pooler, port 5432, role postgres — the SAME string you set as Vercel's DIRECT_DATABASE_URL). Never commit it. After that, migrations apply automatically on merge to main (idempotent; safe no-op when already applied). See docs/ci/PROPOSED_CI.md."
      blocks: none
    - id: eas-build-submit-go-live
      title: EAS project + store/signing creds + the actual build & submit (Human-Core)
      priority: high
      status: open
      why: "The loop builds + validates the release config (eas.json prod build+submit, app config, env-driven projectId) but cannot create the EAS project, hold signing creds, or run the real signed build/submit."
      how: "Run `eas init` in apps/mobile; set EXPO_PUBLIC_PROJECT_ID (+ EAS secrets) to the real projectId; create Apple App Store Connect + Google Play accounts; fill eas.json submit creds (appleId/ascAppId/appleTeamId + google-play-key.json); then `eas build --profile production` + `eas submit`. The loop never touches signing/secrets."
      blocks: launch
    - id: connect-revenuecat-iap
      title: "Connect RevenueCat to activate mobile in-app purchases (purchase flow + webhook CODE is built, PR #266)"
      priority: high
      status: open
      why: "The mobile purchase flow (Purchases.purchasePackage + Restore, apps/mobile), the wrapper (apps/mobile/lib/purchases.ts), and the server entitlement webhook (apps/web/app/api/webhooks/revenuecat/route.ts → same preference_signals ledger as Stripe) are built and gate-green; the screen degrades to an honest 'Payments coming soon' state until configured. An App-Store-targeted app must accept payment on device, so this is a critical-path owner step — only the live keys + dashboard config are Human-Core."
      how: "RevenueCat dashboard: create project → add App Store + Google Play apps → create a `premium` entitlement → attach the monthly/annual products (product ids containing annual/family map to the right tier). Set EXPO_PUBLIC_REVENUECAT_IOS_KEY + EXPO_PUBLIC_REVENUECAT_ANDROID_KEY (public SDK keys) in EAS env. RevenueCat → Webhooks → point at https://yourapp.com/api/webhooks/revenuecat, set an Authorization header value, and set the SAME value as REVENUECAT_WEBHOOK_AUTH in Vercel env (the route returns 401 until set — no unauthenticated entitlement writes). Verify: sandbox purchase → entitlement active → webhook fires → preference_signals topic='entitlement' value='premium'. See docs/LAUNCH.md Step 7."
      blocks: launch
    - id: verify-signup-dashboard-prod
      title: "DONE: signup → onboarding → dashboard verified working on the DEPLOYED app"
      priority: urgent
      status: done
      resolved: "2026-06-28 — verified via Supabase MCP: 19 users, 16 created in the last 7 days (most recent 2026-06-28 04:53). Active real signups landing successfully = the signup→dashboard journey works in prod. Both root causes (migration drift + the non-UUID 'user-1' session 500) are fixed and live."
      why: "ROOT CAUSE FOUND via the Supabase MCP (prod inspection), two separate issues. (1) Migration drift: prod was missing 0011–0017 — now APPLIED via MCP (push_tokens, waitlist_submissions + UTM/confirm cols, content_schedule, experiment_exposures/conversions; all RLS-enabled). This had broken the PUBLIC WAITLIST in prod, but was NOT the dashboard break. (2) The dashboard break: prod logs showed recurring `invalid input syntax for type uuid: \"user-1\"` in bursts of 5 — the authed home runs 5 reads in one withTenant(userId) tx, and a session whose JWT uid is the non-UUID string \"user-1\" makes the RLS uuid-cast throw → the home subtree 500s. \"user-1\" is NOT a real user (all 17 users are valid UUIDs; the normal signup path can only set a UUID) — it's a stale/forged/legacy session. A real NEW signup gets a UUID and the dashboard works. Fixed defensively: currentUserId() now treats a non-UUID session as signed-out, and withTenant() fails closed on a non-UUID id (PR: fix-non-uuid-session-dashboard-500)."
      how: "Migrations: DONE (applied to prod via MCP; verified all 5 tables exist with RLS on; security advisor clean of new issues). REMAINING (owner): sign up a throwaway account on the deployed URL and confirm it lands on a working dashboard. Optional: rotate AUTH_SECRET to evict the stale \"user-1\" session and clear the log noise (the defensive fix already makes it harmless — a non-UUID session now renders logged-out instead of 500ing). To pin in CI: BASE_URL=<prod> pnpm --filter @gm/web e2e journeys."
      blocks: launch-functional
    - id: wire-e2e-journeys-ci
      title: "DONE: functional E2E journeys wired into CI as a REQUIRED, enforced check"
      priority: high
      status: done
      resolved: "2026-06-28 — the `e2e functional journeys (BUILDS != WORKS)` job is live in .github/workflows/ci.yml (builds the web app, runs the outcome-asserting suite against a migrated throwaway Postgres) and is now a REQUIRED status check on main with enforce_admins=true (#234, #241). A build-but-broken flow now BLOCKS the merge — for admins/the loop too."
      why: "The loop validates that the app BUILDS, not that it WORKS. The new outcome-asserting suite (apps/web/e2e/journeys.spec.ts) catches build-but-broken flows, but the autonomous loop cannot edit .github/. Until it's a CI job, a broken user flow won't block a PR."
      how: "DONE (PR #234, from an interactive session with workflow scope): the `e2e functional journeys (BUILDS != WORKS)` job builds web, migrates a throwaway pgvector Postgres, `next start`s with AUTH_TRUST_HOST + a test-only RATE_LIMIT_DISABLED bypass, and replays the suite. It is a REQUIRED status check (enforce_admins on) so a build-but-broken flow can't auto-merge. Captcha fails open without the Turnstile key, so signup works in CI."
      blocks: none
    - id: wire-e2e-roundtrip-ci
      title: "DONE: F4.1 email round-trip runs in the CI e2e job (EMAIL_CAPTURE_DIR wired; no longer skips)"
      priority: normal
      status: done
      resolved: "2026-06-29 (#268) — EMAIL_CAPTURE_DIR (a temp dir, no secret) is wired into the e2e job and the job runs `e2e email-roundtrip`. The waitlist double-opt-in side-effect now VALIDATES in CI (passed green on #268) instead of skipping. Enforced going forward by the new self-validation tripwire (capabilities.json declares EMAIL_CAPTURE_DIR as a requiresCiEnv, so un-wiring it would turn the required check RED)."
      why: "F4.1's email round-trip (apps/web/e2e/email-roundtrip.spec.ts) proves the waitlist double-opt-in actually dispatches → retrieves → confirms. It needs the server AND the test to share an EMAIL_CAPTURE_DIR sink. The loop runs it green LOCALLY at the readiness gate (verified run 25), but the CI e2e job doesn't set EMAIL_CAPTURE_DIR yet, so in CI the spec SKIPS loudly (never fails, never fakes green). Wiring it makes the round-trip a permanent blocking check, not just a gate-time one. The loop can't edit .github/."
      how: "In the `e2e functional journeys` job (.github/workflows/ci.yml), export EMAIL_CAPTURE_DIR=$RUNNER_TEMP/email-sink for BOTH the `next start` step and the playwright step (same value, same runner — the server writes, the test reads), then either let the default `e2e` run pick it up or add `pnpm --filter @gm/web e2e email-roundtrip`. No secret needed; EMAIL_CAPTURE_DIR fails closed in prod runtimes (resolveEmailCaptureDir) so it's safe to set only in CI."
      blocks: none
    - id: track-h-activation
      title: "IN PROGRESS (GTM run 8): CRON_SECRET + an email provider key + PLAUSIBLE_API_KEY CONFIRMED live; other listed vars unverified"
      priority: high
      status: in_progress
      why: "The publishing engine, email runner, and cron endpoint are all dormant until credentials are set. GTM run 8 confirmed via a real round-trip (Bearer $CRON_SECRET against GET /api/growth/snapshot returned 200) that CRON_SECRET, a supported email provider key, and PLAUSIBLE_API_KEY are all live. NOT independently verified by this pull: EMAIL_FROM, EMAIL_UNSUBSCRIBE_SECRET, WAITLIST_OPTIN_SECRET, X_API_KEY/BUFFER_ACCESS_TOKEN/TYPEFULLY_API_KEY, and whether /api/cron/publish is actually scheduled as a Vercel Cron Job — none of these are exposed by the snapshot endpoint, so they stay unverified rather than assumed."
      how: |
        Apply migration 0015 (waitlist confirmed_at) via `pnpm --filter @gm/db db:migrate`, then
        set these in Vercel env (never committed):
          CRON_SECRET=<random 32+ char secret>  (gates BOTH GET /api/cron/publish AND GET /api/growth/snapshot)
          RESEND_API_KEY=re_...  (or SENDGRID_API_KEY / POSTMARK_API_KEY — first key found wins)
          EMAIL_FROM=hello@yourdomain.com  (sender address; defaults to noreply@grocerymanager.app)
          EMAIL_FROM_NAME=GroceryManager  (optional sender display name)
          EMAIL_UNSUBSCRIBE_SECRET=<random 32+ char secret>  (HMAC for unsubscribe tokens)
          WAITLIST_OPTIN_SECRET=<random 32+ char secret>  (HMAC for waitlist double-opt-in confirm links)
          NOTE (PR #378): these two HMAC secrets are now REQUIRED in a prod runtime. The
          email-unsubscribe (/api/email/unsubscribe) and waitlist-confirm (/api/waitlist/confirm)
          paths FAIL CLOSED (throw) rather than sign with the public dev fallback (which would make
          tokens forgeable). Signup/login are unaffected — they never use these. Set both before
          going live; the email lifecycle + waitlist double-opt-in flows will error until they are set.
          PLAUSIBLE_API_KEY=<Plausible Stats API key>  (lets GET /api/growth/snapshot pull real visitors)
          X_API_KEY=<X/Twitter Bearer token>  (for publishItem to X — optional, skip if not using X)
          BUFFER_ACCESS_TOKEN=<token>  (for Buffer scheduling — optional)
          TYPEFULLY_API_KEY=<key>  (for Typefully scheduling — optional)
        Wire /api/cron/publish as a Vercel Cron Job (vercel.json crons field, hourly) with Authorization: Bearer $CRON_SECRET.
        Full step-by-step: docs/growth/CONNECT.md (the ~20-min owner activation runbook).
      blocks: growth-execution
    - id: site-gate-prelaunch
      title: "DONE: SITE_GATE_PASSWORD is set — site is gated pre-launch; UNSET it at actual public launch"
      priority: high
      status: done
      resolved: "2026-07-03 (GTM run 5) — verified via direct curl against the live deployed URL
        (https://grocery-manager-web.vercel.app): home/blog/privacy return HTTP 200 (site-gate-exempt) while
        /signup and /admin/waitlist return HTTP 401 (gated) — exactly the exempt-vs-gated split
        apps/web/middleware.ts implements, which is only possible with SITE_GATE_PASSWORD set. This is
        real, reproducible public-HTTP evidence (no secret read). GROWTH_STATUS.site_gate_up flipped to
        true this run. REMAINING: this item's `at-launch` step (UNSET SITE_GATE_PASSWORD) is a distinct,
        FUTURE owner action — do NOT unset it now; the app is not launch-ready (mobile store submission +
        RevenueCat + a connected marketing channel are all still open elsewhere in this file)."
      why: "The deployed app must NOT be publicly reachable until it is launch-ready — we never expose a half-baked app, and pre-launch we want WAITLIST-ONLY traffic. The code-level gate is built (env-driven middleware; public waitlist/landing + legal pages exempt so people can still join), but the password VALUE is human-applied and must never be committed. This is also the HARD precondition that flips GROWTH_STATUS.site_gate_up to true and lets the Growth Agent leave PREPARE mode (the SECOND precondition — a connected marketing channel — is still open; see connect-channels / track-h-activation below)."
      how: "DONE: SITE_GATE_PASSWORD is set in Vercel env (gate is ON; confirmed via live HTTP behavior above). At ACTUAL public launch (every ship-critical QUALITY_SCORECARD dim A/A+ + readiness passed + store submission complete): UNSET SITE_GATE_PASSWORD to open the app, then announce to the waitlist. Never commit the value. (Mobile pre-launch is gated via TestFlight / internal track.)"
      blocks: none
    - id: gated-beta-invite-codes
      title: "Run the gated beta (§34 Part B): apply migration 0021 + set SITE_GATE_INVITE_SECRET + mint invite codes"
      priority: medium
      status: open
      why: "§34 Part B (PR #475, run 56) ships DB-backed beta invite codes: a waitlisted person redeems the code you issued them at /join, which grants a DISTINCT site-gate cookie so /signup becomes reachable (the full app stays gated for everyone else) — this yields the first real PMF cohort. The invite MECHANISM is fully built + tested (code alphabet/redeem/rate-limit/RLS all in code), but it only ACTIVATES once you: (a) apply migration 0021 (adds the invite columns), (b) set SITE_GATE_INVITE_SECRET, and (c) mint + send codes. Without (b), the redeem route degrades to a calm 503 ('beta access is still being set up') — it deliberately NEVER falls back to handing out the master SITE_GATE_PASSWORD (that would let any invitee leak your admin override). Post-§13 Gate-1 activity (invites go out once a marketing channel is connected + you're ready for the first cohort)."
      how: "(1) Apply migration 0021: `pnpm --filter @gm/db db:migrate` (idempotent — adds invite_code / invite_issued_at / invite_redeemed_at + a partial unique index to waitlist_submissions; needs DIRECT_DATABASE_URL). (2) In Vercel env, set SITE_GATE_INVITE_SECRET to a random value that is DIFFERENT from SITE_GATE_PASSWORD (e.g. `openssl rand -hex 24`); it can be rotated independently if ever leaked (invitees just re-redeem their still-valid codes). Never commit the value. (3) Mint codes for confirmed waitlist emails: `pnpm --filter @gm/workers invite:issue [count]` (default 25, oldest-confirmed first; `--email you@example.com` for a specific one) — it prints an email → CODE table + an issued/redeemed cohort summary. Send each person their code, or a `/join?code=<CODE>` link (email delivery is your call — the loop never sends on your behalf). Verify: visit /join?code=<a-real-code> in a fresh browser → redeem → you land on /signup; an invalid code shows a generic 'not valid' message."
      blocks: none
    - id: spend-caps
      title: "URGENT (elevated, GTM run 8): Set HARD daily API spend caps + alerts — Stripe/Plausible/email keys now CONFIRMED LIVE"
      priority: urgent
      status: open
      why: "If the app is live and calls any paid API, an abuse spike or runaway loop can run up cost. A spend cap is the only hard backstop (Track G7). ELEVATED this run: GTM run 8 confirmed via a real authenticated round-trip that STRIPE_SECRET_KEY, PLAUSIBLE_API_KEY, and an email provider key are all now live in the deployed app — real paid surfaces are active, not hypothetical. This item was already open; it is now materially more urgent."
      how: Google Cloud / Vertex Budgets; Twilio usage triggers; Stripe Radar; Anthropic Console spend limit; Plausible/email-provider usage alerts. Regenerate any key that has been exposed.
      blocks: launch-safety
    - id: connect-channels
      title: "IN PROGRESS: email channel connected (GTM run 8); no social channel yet"
      priority: high
      status: in_progress
      why: "The Growth Agent stays in honest 'prepare only' mode until you connect your own authorized channels (social API token, email provider, analytics). GTM run 8 confirmed (real round-trip, not self-report) that an email provider key IS connected — GROWTH_STATUS.channels_connected flipped to [email]. No social channel (X/Buffer/Typefully token) is connected yet. NOTE: even with a channel connected, GTM_STANDARD §6's launch gate keeps automated outbound sends OFF until phase==post_launch — connecting a channel unlocks real DATA, not sends."
      how: "Optionally connect a social channel too (X_API_KEY / BUFFER_ACCESS_TOKEN / TYPEFULLY_API_KEY — see track-h-activation) for broader reach once launched. No further action required to keep the email channel connected."
      blocks: none
    - id: rotate-envl-secrets
      title: Confirm .envl secrets are safe (GitHub push protection blocked a commit containing them)
      priority: high
      status: open
      why: A local .envl held a real GCP API key + Google OAuth client id/secret and was almost committed; GitHub push protection blocked it so it was NOT published. It is now gitignored. Rotate as a precaution if it was ever pushed/shared elsewhere.
      how: Keep .envl local-only (now in .gitignore). If in any doubt, rotate the GCP key + Google OAuth secret and update Vercel env. Verify no secret ever landed on origin.
      blocks: launch-safety
    - id: ci-workflow-scope
      title: "DONE: lint + E2E steps live in CI (both REQUIRED, enforced checks)"
      priority: normal
      status: done
      resolved: "2026-06-28 — `lint (web, zero warnings)` and `e2e functional journeys (BUILDS != WORKS)` are both live jobs in .github/workflows/ci.yml and REQUIRED status checks on main with enforce_admins=true. Superseded by / duplicate of wire-e2e-journeys-ci."
      why: The autonomous loop cannot edit .github/workflows/. Lint + E2E are merged but not wired into CI.
      how: Add `pnpm --filter web lint` and the E2E job to .github/workflows/ci.yml (see prose entry below).
      blocks: none
    - id: waitlist-migration
      title: "NORMAL (downgraded, GTM run 8): Set ADMIN_EMAIL in Vercel — now only for human /admin/waitlist UI access, not the Growth Agent's own analytics"
      priority: normal
      status: open
      why: "The in-app waitlist analytics needs the admin email for the HUMAN-facing `/admin/*` UI. GTM run 8 confirmed the Growth Agent's OWN read need is already satisfied via CRON_SECRET (GET /api/growth/snapshot returned a real waitlist total without ADMIN_EMAIL) — so this item no longer blocks growth analytics, only your own convenience browsing /admin/waitlist directly. Migrations 0012-0017 were already confirmed applied to prod in earlier runs (RLS on, experiment tables present)."
      how: "Run `pnpm --filter @gm/db db:migrate` (idempotent; applies 0012 waitlist, 0013 UTM, 0014 content_schedule, 0015 confirmed_at, 0016 RLS on the two admin growth tables, 0017 experiment exposure/conversion tables); set ADMIN_EMAIL in Vercel env (see prose entry below)."
      blocks: none
    - id: referral-credits-migration
      title: Apply migration 0018 (referral_credits) — H13 referral rewards
      priority: high
      status: done
      why: "H13 (referral-reward loop, PR #217) persists earned free months in `referral_credits` (RLS tenant-isolation, grocery_app + app_current_user_id() + explicit GRANT). Without the table, `/invite` + `/upgrade` reconcile/read fails closed (resilient catch → zeroed rewards shown) and the bonus-trial-days redemption at Stripe checkout is skipped — the lever is inert until applied. Apply before referral rewards go live."
      how: "Run `pnpm --filter @gm/db db:migrate` (idempotent; applies 0018_referral_credits.sql). No new env vars — the bonus rides the existing STRIPE_PRICE_* + checkout flow. Verify: `SELECT * FROM referral_credits LIMIT 1;` returns an empty result (table exists); after a milestone is reached a row appears keyed by (user_id, reason='milestone_N')."
      blocks: none
    - id: lifecycle-email-migration
      title: "Schedule H14/H15 lifecycle crons + email provider key (migration 0019 already APPLIED to prod via MCP)"
      priority: high
      status: open
      why: "H14 (month-3 annual nudge) + H15 (win-back), PR #221, persist one row per (user, campaign) in `lifecycle_email_sends` (RLS tenant-isolation, grocery_app + app_current_user_id() + explicit GRANT) so a user is never re-emailed for the same campaign. Without the table the cron INSERT fails (best-effort catch → the campaign would re-send each run once a provider is connected). The campaigns also stay DORMANT until an email provider key is set (sends dry-run-skip + are NOT recorded — no fake success) AND the two cron routes are scheduled. No adoption % is banked in the business case — these are dormant infra until you connect + schedule them."
      how: "1) Run `pnpm --filter @gm/db db:migrate` (idempotent; applies 0019_lifecycle_email_sends.sql). Verify: `SELECT * FROM lifecycle_email_sends LIMIT 1;` returns empty (table exists). 2) Set an email provider key (RESEND_API_KEY / SENDGRID_API_KEY / POSTMARK_API_KEY — first found wins) + EMAIL_FROM / EMAIL_UNSUBSCRIBE_SECRET (see track-h-activation). 3) Schedule the two routes as Vercel Cron Jobs (weekly), passing the secret: `/api/cron/h14-annual-nudge?key=$CRON_SECRET` and `/api/cron/h15-winback?key=$CRON_SECRET` (e.g. Mon 09:00 + Tue 10:00; note Vercel Hobby allows daily-granularity crons — pick days the plan supports). Until both steps are done the routes return {sent:0, skipped:N} honestly."
      blocks: none
    - id: experiment-secret
      title: (Optional) set EXPERIMENT_SECRET for A/B variant bucketing
      priority: normal
      status: open
      why: The H10 experiment engine keys its deterministic HMAC variant bucketing off `EXPERIMENT_SECRET` if set, else falls back to `WAITLIST_OPTIN_SECRET` / `EMAIL_UNSUBSCRIBE_SECRET` / `AUTH_SECRET` (one of which is always present in any real deploy). Bucketing is a UI-variant boundary, NOT an auth boundary, so this is OPTIONAL — set a dedicated secret only if you want experiment assignment isolated from the other secrets' rotation. No hardcoded constant is used.
      how: "Optionally set EXPERIMENT_SECRET (any long random string) in Vercel env. If unset, bucketing works off AUTH_SECRET automatically — no action needed."
      blocks: none
    - id: turnstile-keys
      title: Create Cloudflare Turnstile site + set CLOUDFLARE_TURNSTILE_SECRET_KEY + NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY
      priority: high
      status: open
      why: The Turnstile captcha is now wired BOTH server-side (verifyTurnstile on waitlist + signup) AND client-side (PR #252 renders the <Turnstile> widget on both forms when NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY is set; it renders nothing — and the server fail-opens — when the key is absent). So the ONLY remaining work is owner config: set the two keys. NOTE: once the SECRET key is set in prod, the SITE key MUST also be set, or the widget won't render a token and verifyTurnstile will reject every signup/waitlist submission (PR #252 fixed the missing widget; setting only the secret would re-break it). As of PR #380, if the SECRET key is absent in a prod runtime the server still fail-opens (so signup is never hard-blocked, per §32) but now logs a LOUD `[captcha] ... MISSING in a PRODUCTION runtime` error every request — so the gap is visible in prod logs until you set the keys.
      how: "Create a site at dash.cloudflare.com → Turnstile. Set BOTH env vars in Vercel: CLOUDFLARE_TURNSTILE_SECRET_KEY (server) and NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY (client). No code change needed — the widget is already rendered in apps/web/app/components/turnstile.tsx. Verify: load /signup in prod and confirm the Turnstile challenge appears, then complete a test signup."
      blocks: launch-safety
    - id: set-token-enc-key
      title: Set TOKEN_ENC_KEY in prod to enable Gmail receipt import (OAuth token encryption at rest)
      priority: high
      status: open
      why: "Gmail receipt import (a Premium feature) needs TOKEN_ENC_KEY to encrypt the Google OAuth access/refresh tokens at rest (docs/GMAIL_SETUP.md marks it REQUIRED). It is an .optional() env, so the app degrades cleanly without it — but before PR #527 a missing key SILENTLY stored null tokens, so Connect-Gmail appeared to succeed while sync later failed with a cryptic 'no valid google token'. As of #527, if TOKEN_ENC_KEY is absent in a prod runtime AND a user connects Google, auth.ts logs a LOUD, self-contained '[auth] TOKEN_ENC_KEY is missing in a PRODUCTION runtime ...' error every time — so the gap is visible in prod logs until you set it (fail-open-but-loud, mirroring the turnstile-keys posture; sign-in is never hard-blocked). A blank/whitespace value is treated as unset (stores null, no throw). Only needed if you ship Gmail import at launch; the rest of the app works without it."
      how: "Generate a 32-byte key (`openssl rand -base64 32`) and set TOKEN_ENC_KEY in Vercel prod env (also DIRECT deploy env if used). No code change needed. Verify: connect Gmail in prod, then trigger a sync and confirm receipts import (and that the loud '[auth] TOKEN_ENC_KEY is missing' log no longer appears)."
      blocks: gmail-import-go-live
    - id: llm-quota-redis-upgrade
      title: Upgrade in-memory rate limiter + LLM quota to Redis (Upstash) for multi-instance
      priority: normal
      status: open
      why: Current rate limiter + LLM quota + the PUBLIC demo spend ceiling (§34) use Node.js in-memory Maps — correct per-instance but not shared across multiple Vercel regions/instances. For single-instance deployments this is sufficient; for global Vercel this needs Redis. The demo ceiling (packages/core/src/security/demo-quota.ts) is the highest-priority of the three because it guards a PUBLIC, no-account paid-LLM endpoint — its global daily cap is currently per-instance, so a scaled-out deployment's effective ceiling is cap×instances. Pre-launch traffic is owner-gated, so wire this BEFORE driving real demo traffic (§13 Gate 1).
      how: "Install @upstash/ratelimit + @upstash/redis; set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in Vercel env. Replace the Map-based buckets in _lib/rate-limit.ts, _lib/llm-quota.ts AND packages/core/src/security/demo-quota.ts (checkDemoQuota — back BOTH the per-IP and the global counter with a shared store) with Upstash Ratelimit."
      blocks: multi-instance-safety
    - id: gtm-content-validation-kit-v1
      title: "OPTIONAL: film + post the content-first demand-validation kit (receipt -> pantry demo)"
      priority: normal
      status: open
      why: "GTM run 11 prepared a short-form content kit (docs/growth/CONTENT_VALIDATION_KIT.md) per the
        new DEMAND_VALIDATION_PLAYBOOK.md — a low-cost, pre-launch way to test real demand signal via
        TikTok/Reels/Shorts comments (not fabricated view/like counts) before spending more on the funnel.
        Hero feature (receipt -> pantry auto-fill) is already corroborated by 2 independent picks (the
        product factory's own /demo page + 2 of demand_signal's 3 durable cited themes), and the demo
        footage source (/demo) is already live — no prototype build needed. This is genuinely optional:
        skipping it has no downside beyond forgoing an early, cheap signal read."
      how: "Read docs/growth/CONTENT_VALIDATION_KIT.md in full. Film 3-5 reaction takes per the shot list
        (§D) using the live /demo page as the on-screen demo, pair with 2-3 of the 8 drafted hooks (§C),
        post to your own TikTok/Reels/Shorts accounts (the GTM factory never creates accounts or posts).
        Every on-screen/caption CTA points at the public waitlist, never /signup. Report back the real
        comment signal (screenshots or counts) — or connect a channel read API — so the next GTM run can
        analyze it per the kit's §G and feed a real result into demand_signal / positioning."
      blocks: none
    - id: decide-ship-households-family-tier
      title: "PRODUCT DECISION: ship household sharing live (FEATURE_HOUSEHOLDS=1) or keep the Family tier dark?"
      priority: normal
      status: open
      why: "ROADMAP H12 (surface the Family/household tier at the paywall + onboarding to lift blended ARPU) is BLOCKED on a product decision, not code. The premium_family billing tier + Stripe checkout + the household-sharing feature (households/household_invites tables, invite flow, shared list, RLS-tested) are all BUILT but flag-dark (FEATURE_HOUSEHOLDS defaults off). PR #227 (and run-24 PR #244) deliberately HIDE Family/household everywhere it's advertised, because advertising a flag-off feature risks Apple 2.3.1 / Google accurate-listing rejection. So H12 cannot be honestly completed until you decide: (A) SHIP households live — set FEATURE_HOUSEHOLDS=1, the loop then un-gates the Family card on /upgrade + the landing + builds the onboarding 'cook together' moment, and the business case can model some Family adoption; or (B) keep it dark — accept zero Family adoption and H12 stays deferred. The business case currently banks ZERO Family revenue, so (A) is the ARPU upside but needs the live feature to be store-honest."
      how: "Decide A or B. If A: tell the loop to un-gate + build the onboarding surface (it will), then set FEATURE_HOUSEHOLDS=1 in Vercel env once you've sanity-checked the household invite → shared-list flow on staging. If B: no action — the tier stays dark and H12 is closed as deferred. Either way the loop will NOT advertise households until the flag is on."
      blocks: revenue-lever-h12
```

---

## 2026-06-27 — BUILDS ≠ WORKS: runtime functional verification + manual-only checks

The loop now has a real-browser functional journey suite (`apps/web/e2e/journeys.spec.ts`, outcome-
asserting; `e2e/ROUTE_INVENTORY.md` for provable coverage). Two human steps:

1. **Deployed signup→dashboard (urgent).** A reported "dashboard not available" after signup did NOT
   reproduce on a fully-migrated DB (the real-browser flow rendered a working dashboard, 200). It's
   environment-specific on prod — apply all migrations to prod and verify on the deployed URL (see the
   `verify-signup-dashboard-prod` OWNER_ACTIONS item). Point the suite at prod to pin it: `BASE_URL=<prod>
   pnpm --filter @gm/web e2e journeys`.
2. **Wire the journey suite into CI** (`wire-e2e-journeys-ci` item) — the loop can't edit `.github/`.

**Manual-only — CANNOT run headlessly; must be MANUALLY verified before launch (never assumed working):**
- Real payment **capture**: a live (then test-mode) Stripe charge actually completes; refund works; the
  webhook fires from Stripe's servers and flips entitlement.
- Email **deliverability**: the connected provider actually sends and lands in an inbox (not just "no-op
  when no key").
- Native **store purchases**: StoreKit / Play Billing on a real device unlocks premium.
- Push-notification delivery to a real device.

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
4. **(Mobile IAP — CODE IS WIRED as of 2026-06-29, PR #266)** The mobile purchase flow
   (`Purchases.purchasePackage()` + Restore) and the server entitlement webhook
   (`/api/webhooks/revenuecat`) are built and degrade gracefully when unconfigured. To go live the
   owner must:
   - **RevenueCat dashboard:** create a project → add the App Store + Google Play apps → create a
     `premium` **entitlement** → attach the monthly/annual products (product ids containing
     `annual`/`family` map to the right tier; see `tierFromProduct` in the webhook).
   - **Public SDK keys** (safe to ship in the client): set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and
     `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` in EAS env (without them the upgrade screen shows the honest
     "Payments coming soon" state).
   - **Webhook:** RevenueCat → Project → Webhooks → point at `https://yourapp.com/api/webhooks/revenuecat`,
     set an **Authorization header value**, and set the SAME value as `REVENUECAT_WEBHOOK_AUTH` in
     Vercel env (the route fails closed — returns 401 — until this is set, so no unauthenticated
     entitlement writes).
   - **(Optional)** `REVENUECAT_API_KEY` — the SECRET REST key, only if you later add server-side
     verification; not required for the webhook.
   - **Verify:** sandbox purchase on a test device → RevenueCat dashboard shows the entitlement →
     the webhook fires → `preference_signals` row `topic='entitlement' value='premium'` appears.

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

## 2026-06-27 — Track H activation: growth-execution engine env vars

The publishing/scheduling engine, email lifecycle runner, and cron endpoint are all code-complete (PRs #167–#171)
and dormant until credentials are provided. To activate the growth engine:

1. **Set `CRON_SECRET`** in Vercel env — a random 32+ character secret. Then wire `/api/cron/publish`
   as a Vercel Cron Job (in `vercel.json` under `crons`):
   ```json
   { "path": "/api/cron/publish", "schedule": "0 * * * *" }
   ```
   Pass the secret as `Authorization: Bearer $CRON_SECRET` in the cron request header.

2. **Set an email provider key** (first one found wins):
   - `RESEND_API_KEY=re_...` (recommended — get from resend.com)
   - OR `SENDGRID_API_KEY=SG...` (sendgrid.com)
   - OR `POSTMARK_API_KEY=...` (postmarkapp.com)
   Also set:
   - `FROM_EMAIL=hello@yourdomain.com` (must be a verified sender in your chosen provider)
   - `EMAIL_UNSUBSCRIBE_SECRET=<random 32+ char secret>` (HMAC key for unsubscribe tokens)

3. **Set social channel tokens** (optional — set only the channels you use):
   - `X_API_KEY=<Bearer token>` — X/Twitter v2 OAuth 2.0 app-only Bearer token
   - `BUFFER_ACCESS_TOKEN=<token>` — Buffer API access token
   - `TYPEFULLY_API_KEY=<key>` — Typefully API key

4. **Verify**: add an item to `content_schedule` via the DB console with `status='scheduled'`
   and `scheduled_at` in the past; trigger the cron endpoint manually; confirm it marks the item
   `published` or `skipped`. Check `/admin/content` shows the updated status.

**Status:** Code complete (PRs #167–#171). Human Core required for all steps above.

---

## 2026-06-27 — Pre-launch SITE GATE: set the password now, unset it at launch (owner-only)

The pre-launch SITE GATE is code-complete (ROADMAP H13): env-driven middleware (`apps/web/middleware.ts`
+ pure logic in `@gm/core/security/site-gate`) password-protects the deployed app whenever
`SITE_GATE_PASSWORD` is set, **exempting the public marketing surface** (the waitlist / "coming soon"
landing + its server action, `/api/waitlist/confirm`, `/privacy`, `/terms`, `/blog`, `/help`) so people
can still join the waitlist. `/signin`, `/signup`, and every app route are gated — so no one signs up to
a half-baked app pre-launch.

1. **Pre-launch:** set `SITE_GATE_PASSWORD=deepster` in Vercel env (never committed). Verify the deployed
   app prompts for the password while the home/waitlist page loads openly. Unlock for yourself by visiting
   `?gate=deepster` once (sets an httpOnly cookie).
2. **Flip the growth precondition:** set `GROWTH_STATUS.site_gate_up: true`. This is the HARD gate that lets
   the Growth Agent leave PREPARE mode for pre-launch execute-mode outreach (channel must also be connected).
3. **At launch** (every ship-critical `QUALITY_SCORECARD` dim `A`/`A+` + readiness passed): **UNSET**
   `SITE_GATE_PASSWORD` to open the app to the public, then announce to the waitlist.

**Status:** Code complete (run 22). Human Core required — the password value is owner-applied, never committed.

---

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

---

## 2026-06-28 — Side-effect round-trip test (ROADMAP F4.1) + waitlist email deliverability

SIDE-EFFECT INTEGRITY (FACTORY_STANDARD §6) is now enforced. Two human-side notes:

1. **F4.1 round-trip — BUILT (run 25, PR #247); CI wiring is the only remaining human step.** The
   email-capture round-trip now exists: `apps/web/e2e/email-roundtrip.spec.ts` submits the waitlist →
   the real confirmation email is dispatched to a file sink (`EMAIL_CAPTURE_DIR`) → retrieved → the
   confirm link is followed → the signup is confirmed (`?confirmed=1`, DB `confirmed_at` set); a
   tampered token does NOT confirm. The loop runs it GREEN locally at the readiness gate. Running it in
   the CI e2e job needs one env var (the loop can't touch `.github/`) — see OWNER_ACTIONS
   `wire-e2e-roundtrip-ci`. Until then it SKIPS loudly in CI (never fakes green); preflight still
   enforces a real green round-trip at the gate (`E2E_ROUNDTRIP_PASSED=1`).
2. **Waitlist confirmation email won't actually send until an email provider is set.** With no
   `RESEND_API_KEY`/`SENDGRID_API_KEY`/`POSTMARK_API_KEY` (see `track-h-activation`), the double-opt-in
   email is a no-op. The product now degrades HONESTLY — it shows "you're on the list" (the address IS
   captured) and only says "check your email" when an email truly left — but visitors won't be able to
   CONFIRM (double-opt-in) until a provider key is set. Set one before relying on confirmed-signup counts.

---

## 2026-06-28 — DECISION: signup is NOT gated on email verification (no gate-on-unbuilt-loop)

Audited auth per FACTORY_STANDARD §6 DECISION COROLLARY. **GroceryManager does NOT have the
gate-on-unbuilt-loop outage** (signup shows no "check your email" wall; account creation is
username+password, signs the user in, and lands them in `/onboarding` → the working app). There is no
password-reset/forgot/verify route either. Email is optional and set only when the user connects Gmail.

**The decision (explicit):** signup intentionally does **not** require email verification — the username-first
design avoids gating on an email-send loop that isn't wired. Re-enable email verification / 2FA / any
confirmation gate ONLY together with: (a) a real provider wired (`RESEND_API_KEY`/etc.), and (b) the
journey round-trip test (ROADMAP F4.1) proving the email is dispatched → received → link followed →
flow completes. A new journey assertion (`VERIFY_DEADEND` in `apps/web/e2e/journeys.spec.ts`) now fails
if signup ever shows a "check your email" dead-end, so this can't regress silently. **No owner action.**

---

## 2026-06-29 — Migrations 0011–0019 applied to prod + auto-migrate wired (schema drift killed)

All migrations are now applied to the production DB (verified via the Supabase MCP): 0011 push_tokens,
0012–0017 (waitlist/UTM/content/confirm/RLS/experiments), 0018 referral_credits, 0019
lifecycle_email_sends — every table present with RLS on; security advisor clean of new issues.

Going forward, the `migrate-prod` CI job (`.github/workflows/ci.yml`) **auto-applies the full chain to
prod on every push to `main`** — but only AFTER `verify` (build green) + `migrate` (the chain validated
against a fresh throwaway DB) pass, so a bad migration never reaches prod. Migrations are idempotent, so
it's a safe no-op when already applied. **One-time owner step to enable it:** add the GitHub Actions
secret `PROD_DIRECT_DATABASE_URL` (the Supabase owner/direct connection — same value as Vercel's
`DIRECT_DATABASE_URL`). Until then the job warns + skips (never blocks). See the `enable-auto-migrate-secret`
OWNER_ACTIONS item. This removes the human-applies-migrations step that caused the signup outage.

## 2026-06-29 — CI performance-budget gate (owner/CI; the headless loop cannot edit `.github/`)

ROADMAP F4 was reconciled (2026-06-29): the E2E + a11y + visual gates are shipped and gating, but a
CI *performance-budget* gate is not wired. `next build` reports per-route first-load JS (~102 kB
shared, verified small) yet nothing asserts a budget. To add one (optional, hardening):
- Add a `bundlesize` or `@lhci/cli` (Lighthouse CI) step to `.github/workflows/ci.yml` asserting
  e.g. per-page first-load < ~110 kB and the middleware bundle < ~150 kB.
- This is a `.github/` change an unattended run must not make (it trips the sensitive-file prompt),
  so it is an owner/CI item. Non-blocking — the app ships without it; it only guards against future
  bundle bloat.
