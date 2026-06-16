# Connect Gmail → auto-fill your pantry

This wires the flagship loop: receipt emails (Amazon / Whole Foods / Instacart) →
extract → normalize → your pantry, with **no manual entry**. The whole chain is already
built; this guide is the ~15 minutes of free setup it needs to run.

Everything here uses Google's **free** tier — no billing, no approval gauntlet (unlike
Instacart). The only Google scope requested is **`gmail.readonly`**.

## What you'll end up with

On the **Pantry** page: a **Connect Gmail** button, then a **Sync receipts now** button
that pulls your latest receipt emails and fills the pantry on the spot — no Redis or
background worker required (those power the automatic hourly sync later).

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com/> → project picker → **New Project**.
2. Name it anything (e.g. `grocery-manager`) and create it.

## 2. Enable the Gmail API

1. **APIs & Services → Library** → search **Gmail API** → **Enable**.

## 3. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. User type **External** → Create.
3. Fill the required app name + your email; **Save and continue**.
4. **Scopes** → **Add or remove scopes** → add `https://www.googleapis.com/auth/gmail.readonly`
   → Update → Save and continue.
5. **Test users** → **Add users** → add the Google account whose receipts you want to read
   (your own). While the app is in "Testing", only listed test users can connect — that's fine
   for personal use, and avoids Google's CASA security review (only needed to ship to the public).

## 4. Create the OAuth client credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type **Web application**.
3. **Authorized redirect URIs** → add (match your dev URL exactly):
   - `http://localhost:3000/api/auth/callback/google`
   - add your deployed URL too if hosting, e.g. `https://your-app.vercel.app/api/auth/callback/google`
4. Create → copy the **Client ID** and **Client secret**.

## 5. Set environment variables

In `.env` (see `.env.example`):

```bash
GOOGLE_CLIENT_ID=<from step 4>
GOOGLE_CLIENT_SECRET=<from step 4>
AUTH_SECRET=$(openssl rand -base64 32)       # NextAuth session signing
TOKEN_ENC_KEY=$(openssl rand -base64 32)     # encrypts stored Gmail tokens at rest (REQUIRED)
GEMINI_API_KEY=<your AI Studio key>          # extracts line items from receipt HTML
DATABASE_URL=...                             # already set if the app runs
```

`TOKEN_ENC_KEY` is **required** — without it the OAuth tokens aren't persisted and the sync
can't authenticate. `GEMINI_API_KEY` is what turns receipt HTML into structured line items.

## 6. Run it

```bash
pnpm db:migrate && pnpm db:seed   # if you haven't already
pnpm dev
```

## 7. Connect + sync

1. Open **/pantry**.
2. Click **Connect Gmail** → sign in with your test-user account → grant read-only Gmail access.
3. Back on **/pantry**, click **Sync receipts now**.
4. It scans your latest receipt emails and reports e.g. *"Synced 8 messages — added 2 receipts,
   14 items; 1 needs review."* The pantry list fills in. Re-syncing is **idempotent** — the same
   email is never counted twice.

Items the matcher isn't sure about land in the **Review inbox** (link on the Pantry page) for a
one-tap fix, rather than silently guessing.

## How it works (and what's optional)

- **Manual sync (this guide):** runs the full chain inline in a server action — zero extra infra.
  Bounded to the latest ~10 messages per tap to stay within a request.
- **Automatic background sync (optional):** the `services/workers` BullMQ worker runs the same
  `pollGmailForUser` + `parseReceiptForUser` on an hourly cron. Set `REDIS_URL` and run the worker
  to fill the pantry continuously without tapping. Same code path as the manual button.
- **Real-time push (optional — instant ingestion):** Gmail `users.watch` → Pub/Sub → a push webhook
  ingests the moment a receipt lands. Built and ready; it just needs a Pub/Sub topic (below). Not
  required — the manual sync + cron/worker poll already cover the functional need.

## Real-time push setup (optional)

Makes receipts ingest instantly instead of on a poll. Works on Vercel with no separate worker.

1. **Create a Pub/Sub topic** in the same Google Cloud project (`gmail-receipts`), and grant Gmail
   permission to publish to it: add member `gmail-api-push@system.gserviceaccount.com` with role
   **Pub/Sub Publisher** on the topic.
2. **Add a push subscription** to that topic with delivery type **Push** and endpoint:
   `https://<your-app>/api/webhooks/gmail?token=<GMAIL_WEBHOOK_SECRET>`
3. **Set env:**
   ```bash
   GMAIL_PUBSUB_TOPIC=projects/<project-id>/topics/gmail-receipts
   GMAIL_WEBHOOK_SECRET=$(openssl rand -base64 24)   # must match the ?token= in the push endpoint
   CRON_SECRET=$(openssl rand -base64 24)            # guards the renew/poll cron route
   ```
4. **Renew the watch daily** (the watch expires ≤7 days). On Vercel this is already wired:
   `apps/web/vercel.json` schedules `/api/cron/gmail` daily (and `/api/cron/digest` weekly). Set
   `CRON_SECRET` in your Vercel project env and Vercel automatically sends
   `Authorization: Bearer <CRON_SECRET>` with each cron call, which the route verifies. (Set the
   Vercel project **Root Directory** to `apps/web`.) Or, if you run the `services/workers` service,
   its `watch-renew` cron does the same. To trigger manually: `curl ".../api/cron/gmail?key=<CRON_SECRET>"`.
   The cron renews each user's watch *and* runs a fallback poll (covers any dropped pushes).

The webhook acks every delivery quickly and runs a bounded inline sync, so it stays within Pub/Sub's
deadline and never double-counts (ingestion is idempotent per Gmail message id).

## Privacy & security

- Scope is **read-only** (`gmail.readonly`) — the app can never send or modify mail.
- OAuth tokens are **encrypted at rest** with `TOKEN_ENC_KEY` (envelope-wrapped via KMS in prod).
- Receipts are matched per-user under Postgres **row-level security** (PLAN §11).
- For a public launch, Google requires a **CASA** security assessment for restricted scopes; for
  personal use with Testing-mode test users, you don't need it.
