-- H8: double-opt-in confirmation timestamp for waitlist sign-ups.
-- A row is "confirmed" once the visitor clicks the confirmation link emailed to them.
-- NULL = pending confirmation (single opt-in only); non-NULL = confirmed (double opt-in).
ALTER TABLE waitlist_submissions
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Partial index to count/scan confirmed signups cheaply (used by the growth snapshot).
CREATE INDEX IF NOT EXISTS waitlist_confirmed_idx
  ON waitlist_submissions (confirmed_at)
  WHERE confirmed_at IS NOT NULL;
