-- 0018: Referral reward credits (H13) — append-only ledger of free months a referrer has EARNED at
-- referral milestones. One row per (user, milestone reason); reconciliation is idempotent via the
-- UNIQUE constraint, so re-running it never double-grants. The earned months convert to bonus free-trial
-- days at the user's first Premium checkout (see @gm/core/referral/rewards + the Stripe checkout route).
-- RLS: per-user isolation via app_current_user_id() GUC (the grocery_app role pattern from 0002_rls.sql)
-- so a tenant only ever reads/writes their own credits. Idempotent: CREATE IF NOT EXISTS + DROP/CREATE
-- POLICY. APPLY: pnpm --filter @gm/db db:migrate  (recorded in PENDING_OPS.md — Human Core).

CREATE TABLE IF NOT EXISTS referral_credits (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  months     integer     NOT NULL CHECK (months > 0),   -- incremental free months for this milestone
  reason     text        NOT NULL,                       -- stable milestone key, e.g. 'milestone_1'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reason)
);

ALTER TABLE referral_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_credits_tenant_isolation ON referral_credits;
CREATE POLICY referral_credits_tenant_isolation ON referral_credits
  FOR ALL
  TO grocery_app
  USING  (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
