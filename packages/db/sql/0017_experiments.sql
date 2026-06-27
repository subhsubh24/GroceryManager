-- ===========================================================================
-- 0017: A/B experiment tables — H10 experiment engine.
--
-- TWO per-user tables (experiment definitions live in code, not DB):
--   experiment_exposures   — one row per user × experiment × variant assignment
--   experiment_conversions — one row per user × experiment × event (conversion signal)
--
-- RLS: per-user isolation via app_current_user_id() (same grocery_app pattern as 0002/0011).
-- Admin/aggregate reads (getExperimentStats) use getAdminDb() which bypasses RLS.
-- Idempotent: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS / CREATE POLICY.
-- APPLY: pnpm --filter @gm/db db:migrate  (Human Core)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS experiment_exposures (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experiment_id text        NOT NULL,
  variant       text        NOT NULL,
  exposed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS experiment_exposures_exp_variant_idx
  ON experiment_exposures (experiment_id, variant);

CREATE INDEX IF NOT EXISTS experiment_exposures_user_exp_idx
  ON experiment_exposures (user_id, experiment_id);

ALTER TABLE experiment_exposures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON experiment_exposures;
CREATE POLICY tenant_isolation ON experiment_exposures
  FOR ALL
  TO grocery_app
  USING  (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON experiment_exposures TO grocery_app;

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS experiment_conversions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experiment_id text        NOT NULL,
  event_name    text        NOT NULL,
  converted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS experiment_conversions_exp_event_idx
  ON experiment_conversions (experiment_id, event_name);

CREATE INDEX IF NOT EXISTS experiment_conversions_user_exp_idx
  ON experiment_conversions (user_id, experiment_id);

ALTER TABLE experiment_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON experiment_conversions;
CREATE POLICY tenant_isolation ON experiment_conversions
  FOR ALL
  TO grocery_app
  USING  (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON experiment_conversions TO grocery_app;
