-- ===========================================================================
-- Row-Level Security for the admin-only growth tables created AFTER 0010.
--
-- `waitlist_submissions` (0012) and `content_schedule` (0014) were created with
-- RLS deliberately OFF because the app only ever touches them via getAdminDb()
-- (which connects as the table OWNER and bypasses RLS). That is safe for the
-- direct `grocery_app` Postgres path. BUT — exactly like the shared catalog
-- tables hardened in 0010_rls_catalog.sql — Supabase/PostgREST also exposes the
-- public schema to the `anon`/`authenticated` roles. With RLS OFF, anyone holding
-- the anon key could read every waitlist email (PII) or read/modify the content
-- schedule through that API. "Every public table has RLS enabled" must hold for
-- ALL public tables, not just the ones that existed when 0010 was written.
--
-- Fix: ENABLE RLS and add ONE permissive policy scoped to `grocery_app`
-- (USING true / WITH CHECK true). This keeps the app's existing admin access
-- intact (the owner BYPASSES RLS, so getAdminDb provisioning + migrations are
-- unaffected) while the PostgREST API roles — which are NOT members of
-- grocery_app and have no policy — are denied by default.
-- Run as OWNER (DIRECT_DATABASE_URL). Idempotent.
-- ===========================================================================

DO $$
DECLARE
  t text;
  admin_tables text[] := ARRAY['waitlist_submissions','content_schedule'];
BEGIN
  FOREACH t IN ARRAY admin_tables LOOP
    -- Skip cleanly if a table doesn't exist in this environment.
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS admin_access ON %I', t);
    EXECUTE format(
      'CREATE POLICY admin_access ON %I TO grocery_app '
      'USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
