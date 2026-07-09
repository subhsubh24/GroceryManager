-- ===========================================================================
-- §34 Part B — gated-beta INVITE CODES on the waitlist.
--
-- The pre-launch funnel is: waitlist → the owner issues each invited person a
-- high-entropy code → the person enters it at /join → a valid code lets them
-- past the SITE_GATE to /signup and the real app (the first PMF cohort). The
-- full app stays gated for everyone without a code.
--
-- Invites live on `waitlist_submissions` (one code per waitlisted email) rather
-- than a new table: the invite IS the "this email is admitted to the beta"
-- fact, so coupling them keeps issuance/redemption tied to the email we already
-- captured. All access is via getAdminDb() (owner connection, bypasses RLS) —
-- exactly like the rest of this admin-only table, already RLS-hardened in
-- 0016_rls_waitlist_content.sql (grocery_app-scoped policy denies the PostgREST
-- anon/authenticated roles). No new table → no new RLS surface.
--
-- Columns:
--   invite_code         canonical code (uppercase base32, no I/L/O/U) — a per-
--                       person BETA KEY; NULL until the owner issues one.
--   invite_issued_at    when the code was first minted (cohort/analytics).
--   invite_redeemed_at  FIRST time the code was redeemed at /join. Redemption is
--                       idempotent (a cleared cookie / second device re-redeems
--                       the same code), so this is set once via COALESCE.
--
-- Run as OWNER (DIRECT_DATABASE_URL). Idempotent.
-- ===========================================================================

ALTER TABLE waitlist_submissions
  ADD COLUMN IF NOT EXISTS invite_code        TEXT,
  ADD COLUMN IF NOT EXISTS invite_issued_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_redeemed_at TIMESTAMPTZ;

-- One code maps to at most one email. UNIQUE also gives the redeem lookup an index and lets the
-- issuer detect a (vanishingly unlikely) collision and retry with a fresh code.
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_submissions_invite_code_idx
  ON waitlist_submissions (invite_code)
  WHERE invite_code IS NOT NULL;
