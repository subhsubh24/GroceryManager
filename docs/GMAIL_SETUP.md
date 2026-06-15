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
- **Real-time push (follow-up, not required):** Gmail `users.watch` + a Pub/Sub push webhook would
  make ingestion instant. The hourly poll / manual sync already cover the functional need, so this
  is a later optimization (the `watch-renew` worker + `/api/webhooks/gmail` route are still stubs).

## Privacy & security

- Scope is **read-only** (`gmail.readonly`) — the app can never send or modify mail.
- OAuth tokens are **encrypted at rest** with `TOKEN_ENC_KEY` (envelope-wrapped via KMS in prod).
- Receipts are matched per-user under Postgres **row-level security** (PLAN §11).
- For a public launch, Google requires a **CASA** security assessment for restricted scopes; for
  personal use with Testing-mode test users, you don't need it.
