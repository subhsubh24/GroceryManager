-- 0019: lifecycle email send ledger (H14 month-3 annual-nudge + H15 win-back).
--
-- One row per (user, campaign) — idempotency so a user is never re-emailed for the SAME campaign.
-- A row is written ONLY after the email truly leaves (provider returned sent=true), so a dry-run
-- (no provider connected) does NOT mark the user as sent and the campaign retries once connected.
-- RLS tenant-isolation (grocery_app + app_current_user_id()) mirrors 0017/0018; the cron writes via
-- the RLS-bypassing owner connection (getAdminDb). Idempotent: IF NOT EXISTS + DROP/CREATE POLICY.
-- APPLY: pnpm --filter @gm/db db:migrate

CREATE TABLE IF NOT EXISTS lifecycle_email_sends (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type text        NOT NULL,
  variant    text,
  sent_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lifecycle_email_sends_user_type_uq
  ON lifecycle_email_sends (user_id, email_type);

ALTER TABLE lifecycle_email_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lifecycle_email_sends_tenant_isolation ON lifecycle_email_sends;
CREATE POLICY lifecycle_email_sends_tenant_isolation ON lifecycle_email_sends
  FOR ALL
  TO grocery_app
  USING  (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON lifecycle_email_sends TO grocery_app;
