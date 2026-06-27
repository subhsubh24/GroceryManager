# Owner CONNECT runbook — activate the growth engine (~20 minutes)

> **H8 deliverable.** This is the single, in-order checklist that flips GroceryManager's
> **growth-execution engine** (Track H) from **dry-run** to **live**. Until each channel's
> credentials are present, that channel stays dry-run and `GROWTH_STATUS` reports
> `awaiting_connect: true` for it — **never faked** (VISION honesty bar).
>
> Everything here is **Human Core** (only you can do it): the loop built all the code; you
> connect the accounts. Set every value as an **environment variable in your host** (e.g.
> Vercel → Project → Settings → Environment Variables). **Never commit `.env` or paste a
> secret into the repo.** Each step says what to set, where, and how to verify it worked.
>
> Cross-reference: `PENDING_OPS.md` (`OWNER_ACTIONS` block) is the machine-readable to-do list;
> `docs/LAUNCH.md` is the full submission handoff. This file is the *growth-activation* slice.

---

## 0. Prerequisite — deploy the app + run migrations

| What | Where | Verify |
|------|-------|--------|
| Deploy `apps/web` | Vercel (or your host); import the repo | the landing page loads at your domain |
| `DATABASE_URL` (+ `DIRECT_DATABASE_URL` for pooled hosts) | host env | app boots; no DB errors in logs |
| Run pending migrations (incl. **0015** double-opt-in) | `pnpm --filter @gm/db db:migrate` | `psql … \d waitlist_submissions` shows a `confirmed_at` column |
| `APP_URL` = your canonical https origin (e.g. `https://grocerymanager.app`) | host env | confirmation links + snapshot redirects use the right domain |

Order matters: **deploy + migrate first** — every channel below assumes the app is live and the
schema is current.

---

## 1. Web analytics (Plausible) — visitor + funnel signal

| Step | Detail |
|------|--------|
| Create a site | [plausible.io](https://plausible.io) → add your domain |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | the exact `site_id` you registered (e.g. `grocerymanager.app`) |
| `PLAUSIBLE_API_KEY` | Plausible → Settings → **API Keys** → create a key with **Stats API** access |
| _(self-hosted only)_ `PLAUSIBLE_API_URL` | your instance base URL (default `https://plausible.io`) |
| **Verify** | the analytics `<script>` appears in page source; `GET /api/growth/snapshot` returns `sources.analytics: "connected"` and a real `funnel.visitors_7d` |

Without `PLAUSIBLE_API_KEY` the snapshot leaves analytics `awaiting_connect` and `visitors_7d: 0`
(the tracking script can still run for in-dashboard viewing, but the read-API needs the key to pull).

---

## 2. Email provider — double-opt-in + lifecycle drips

Pick **one** provider; the sender auto-detects in this order: Resend → SendGrid → Postmark.

| Step | Detail |
|------|--------|
| Create an account + verify your sending domain (SPF/DKIM) | [resend.com](https://resend.com) / [sendgrid.com](https://sendgrid.com) / [postmarkapp.com](https://postmarkapp.com) |
| `RESEND_API_KEY` **or** `SENDGRID_API_KEY` **or** `POSTMARK_API_KEY` | provider dashboard → API keys |
| `EMAIL_FROM` | your verified from-address (e.g. `hello@grocerymanager.app`); defaults to `noreply@grocerymanager.app` |
| `EMAIL_FROM_NAME` _(optional)_ | sender display name; defaults to `GroceryManager` |
| `WAITLIST_OPTIN_SECRET` | a long random string (`openssl rand -hex 32`) — signs the double-opt-in link |
| `EMAIL_UNSUBSCRIBE_SECRET` | a long random string — signs one-click unsubscribe links |
| **Verify** | submit a test email on the landing page → you receive a "Confirm your spot" email → clicking it lands on `/?confirmed=1`; `GET /api/growth/snapshot` shows `sources.email: "connected"` and a non-zero `email.list_size` after confirmations |

Until a provider key is set, signups are still **captured + stored** (single opt-in), but no
confirmation email is sent and `email.list_size` (confirmed count) stays `0` — honest, not broken.

---

## 3. Social channel(s) — content scheduler publishing

Connect **only** channels you own. The scheduler publishes the staged content calendar via
**authorized APIs** — it never auto-creates accounts or posts to communities (Track H5 guardrails).

| Step | Detail |
|------|--------|
| `X_API_TOKEN` (your own X/Twitter app's bearer/OAuth token) | [developer.x.com](https://developer.x.com) → your app |
| _or_ `BUFFER_ACCESS_TOKEN` | [buffer.com](https://buffer.com) → developers |
| _or_ `TYPEFULLY_API_KEY` | Typefully → settings → API |
| `CRON_SECRET` | a long random string — gates **both** `GET /api/cron/publish` (this step) **and** the Growth Agent's headless `GET /api/growth/snapshot` pull (step 6). Set it once. |
| Schedule the cron | host scheduler (e.g. Vercel cron) → `GET /api/cron/publish` with `Authorization: Bearer $CRON_SECRET`, e.g. every 15 min |
| **Verify** | a due `content_schedule` row flips to `published`; `/admin/content` shows it |

No token → the scheduler is a safe no-op (rows stay `scheduled`).

---

## 4. Billing (Stripe) — trial→paid + MRR signal

Full billing setup lives in `docs/LAUNCH.md` / `PENDING_OPS.md`. For **growth reporting**, the
snapshot needs only:

| Step | Detail |
|------|--------|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (live key for production) |
| (+ price IDs + webhook secret — see `docs/LAUNCH.md`) | required for charging, not just reporting |
| **Verify** | `GET /api/growth/snapshot` shows `sources.billing: "connected"`; once real subscriptions exist, `funnel.active_subscribers` + `funnel.mrr_usd` populate from the entitlement ledger |

Without `STRIPE_SECRET_KEY` the snapshot reports billing `awaiting_connect` and keeps subscriber
numbers at `0`.

---

## 5. Bot protection (Cloudflare Turnstile) — already wired, just add keys

| Step | Detail |
|------|--------|
| Add a Turnstile site | [Cloudflare dashboard](https://dash.cloudflare.com) → Turnstile |
| `CLOUDFLARE_TURNSTILE_SECRET_KEY` | server-side verification key |
| `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` | client widget key |
| **Verify** | the waitlist + signup forms render the Turnstile widget; submissions without a token are rejected |

Fail-open in dev: with no key, the captcha check passes so local testing isn't blocked.

---

## 6. Admin access to the read-API + dashboards

| Step | Detail |
|------|--------|
| `ADMIN_EMAIL` | the account email allowed to view `/admin/*` + call `GET /api/growth/snapshot` from a logged-in session |
| **Verify** | sign in as that user → `/admin/growth`, `/admin/waitlist`, `/admin/content` load; `GET /api/growth/snapshot` returns JSON (not 403) |

The Growth Agent calls the snapshot **headlessly** with the `CRON_SECRET` bearer token — the **same
value** set in step 3 (one secret gates both the publish cron and the snapshot pull). It never needs
a session and never holds any of these keys.

---

## The dry-run → live flip, in one glance

| Channel | Env to set | `sources.*` becomes `connected` when… |
|---------|-----------|----------------------------------------|
| waitlist datastore | (migration 0012/0013/0015) | the table + `confirmed_at` exist |
| analytics | `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` + `PLAUSIBLE_API_KEY` | the Stats API returns visitors |
| email | one provider key + `EMAIL_FROM` | a provider key is present |
| billing | `STRIPE_SECRET_KEY` | the key is present |

**Final check:** after connecting, hit `GET /api/growth/snapshot` (admin session or
`Authorization: Bearer $CRON_SECRET`). Every connected channel shows `connected` with real
numbers; everything unconnected stays `awaiting_connect` with `0`/`null`. That JSON is exactly
what the Growth Agent writes into `docs/growth/GROWTH_STATUS.md` each run — **real signal only.**
