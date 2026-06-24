-- Waitlist submissions — stores pre-launch email captures from the landing page.
-- Owner must apply this migration before launch (see PENDING_OPS.md).
-- No RLS: admin-only table, always accessed via getAdminDb() (bypasses RLS).

CREATE TABLE IF NOT EXISTS waitlist_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'landing_page',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deduplicate on email so re-submissions are safe and idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_submissions_email_idx
  ON waitlist_submissions (lower(email));
