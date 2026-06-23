-- ===========================================================================
-- Row-Level Security: full runtime multi-tenant enforcement (PLAN §11).
-- Run as the table OWNER (migrate.ts uses DIRECT_DATABASE_URL). Idempotent.
--
-- Enforcement model: the app connects as a restricted, non-owner login role that is a member of
-- `grocery_app`. Each request runs inside a transaction that does
--   select set_config('app.current_user_id', '<uuid>', true);
-- (see withTenant in client.ts). Policies compare rows to that GUC. The owner/superuser BYPASSES
-- RLS (so migrations + getAdminDb provisioning keep full access) — which is exactly why the runtime
-- MUST NOT connect as the owner, or this is security theater.
-- ===========================================================================

-- 1. App role: a NOLOGIN group, no BYPASSRLS, owns nothing. A per-environment LOGIN role is granted
--    membership out-of-band (locally: CREATE ROLE app_user LOGIN PASSWORD '…' IN ROLE grocery_app;).
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grocery_app') THEN
    CREATE ROLE grocery_app NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO grocery_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grocery_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO grocery_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO grocery_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO grocery_app;

-- 2. The current tenant from the session GUC. NULLIF guards the empty-string the GUC reverts to on a
--    pooled connection between transactions, so an unset context DENIES (NULL) instead of erroring on
--    ''::uuid. One place to change the predicate; policies just call it.
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
  LANGUAGE sql STABLE AS
$fn$ SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid $fn$;
GRANT EXECUTE ON FUNCTION app_current_user_id() TO grocery_app;

-- 3. Per-table RLS, all keyed on app_current_user_id() (deny-by-default when unset).
DO $$
DECLARE
  t text;
  -- Tables owned directly via a user_id column.
  direct_tables text[] := ARRAY[
    'oauth_credentials','push_subscriptions','purchases','pantry_stock','stock_ledger',
    'consumption_events','pantry_scans','meal_logs','shopping_lists','reorder_policies',
    'reorder_predictions','user_models','preference_signals','ingredient_match_overrides'
  ];
BEGIN
  FOREACH t IN ARRAY direct_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I TO grocery_app '
      'USING (user_id = app_current_user_id()) '
      'WITH CHECK (user_id = app_current_user_id())', t);
  END LOOP;
END $$;

-- 3a. users: keyed on the primary key `id`.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users TO grocery_app
  USING (id = app_current_user_id())
  WITH CHECK (id = app_current_user_id());

-- 3b. Child tables: ownership is transitive through the parent.
ALTER TABLE purchase_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON purchase_line_items;
CREATE POLICY tenant_isolation ON purchase_line_items TO grocery_app
  USING (EXISTS (SELECT 1 FROM purchases p
                 WHERE p.id = purchase_line_items.purchase_id AND p.user_id = app_current_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM purchases p
                      WHERE p.id = purchase_line_items.purchase_id AND p.user_id = app_current_user_id()));

ALTER TABLE pantry_scan_detections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON pantry_scan_detections;
CREATE POLICY tenant_isolation ON pantry_scan_detections TO grocery_app
  USING (EXISTS (SELECT 1 FROM pantry_scans s
                 WHERE s.id = pantry_scan_detections.pantry_scan_id AND s.user_id = app_current_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM pantry_scans s
                      WHERE s.id = pantry_scan_detections.pantry_scan_id AND s.user_id = app_current_user_id()));

ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON shopping_list_items;
CREATE POLICY tenant_isolation ON shopping_list_items TO grocery_app
  USING (EXISTS (SELECT 1 FROM shopping_lists l
                 WHERE l.id = shopping_list_items.shopping_list_id AND l.user_id = app_current_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM shopping_lists l
                      WHERE l.id = shopping_list_items.shopping_list_id AND l.user_id = app_current_user_id()));

-- 4. Shared catalog tables (units_of_measure, canonical_items, products, recipes,
--    recipe_ingredients, item_unit_conversions) are readable/writable by all tenants.
--    Their grants come from step 1. RLS for them is enabled with a permissive
--    grocery_app policy in 0010_rls_catalog.sql — required so they aren't exposed
--    through Supabase's PostgREST API to the anon/authenticated roles.
