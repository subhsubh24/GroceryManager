-- ===========================================================================
-- Row-Level Security for the SHARED CATALOG tables (closes Supabase Security
-- Advisor "RLS Disabled in Public" errors).
--
-- 0002_rls.sql deliberately left these six tables without RLS because they hold
-- no per-user rows — every tenant reads (and the app writes) the same catalog.
-- That is safe for the app, which connects as the restricted `grocery_app` login
-- role over a direct Postgres connection. BUT Supabase also exposes the public
-- schema through its auto-generated PostgREST API to the `anon`/`authenticated`
-- roles. With RLS off, anyone holding the anon key could read or — worse —
-- INSERT/UPDATE/DELETE catalog rows through that API and poison the shared
-- product/recipe data for all tenants.
--
-- Fix: ENABLE RLS on each table and add ONE permissive policy scoped to
-- `grocery_app` (USING true / WITH CHECK true). This keeps the app's existing
-- "all tenants read+write the shared catalog" behavior intact, while the API
-- roles (which are NOT members of grocery_app and have no policy) are denied by
-- default. The table owner still BYPASSES RLS, so migrations + getAdminDb
-- provisioning keep full access. Run as OWNER (DIRECT_DATABASE_URL). Idempotent.
-- ===========================================================================

DO $$
DECLARE
  t text;
  -- Shared catalog: no user_id; every tenant uses the same rows.
  catalog_tables text[] := ARRAY[
    'units_of_measure','canonical_items','products','recipes',
    'recipe_ingredients','item_unit_conversions'
  ];
BEGIN
  FOREACH t IN ARRAY catalog_tables LOOP
    -- Skip cleanly if a table doesn't exist in this environment.
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS catalog_access ON %I', t);
    EXECUTE format(
      'CREATE POLICY catalog_access ON %I TO grocery_app '
      'USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
