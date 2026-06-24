-- 0011: Expo mobile push token storage — one row per (user, device) pair.
-- RLS: per-user isolation via app_current_user_id() GUC (the grocery_app role pattern from 0002_rls.sql).
-- Idempotent: CREATE IF NOT EXISTS + DROP POLICY IF EXISTS / CREATE POLICY.
-- APPLY: pnpm --filter @gm/db db:migrate  (recorded in PENDING_OPS.md — Human Core).

CREATE TABLE IF NOT EXISTS push_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      text        NOT NULL,          -- Expo push token: ExponentPushToken[...]
  device_id  text,                          -- opaque device fingerprint (optional)
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_tokens_tenant_isolation ON push_tokens;
CREATE POLICY push_tokens_tenant_isolation ON push_tokens
  FOR ALL
  TO grocery_app
  USING  (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
