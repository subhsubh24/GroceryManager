-- ===========================================================================
-- Shared household — opt-in shared shopping list (FEATURE_HOUSEHOLDS, default OFF).
-- Idempotent. Run as the table OWNER (migrate.ts uses DIRECT_DATABASE_URL), like the other sql/*.
--
-- Members (users whose membership pointer `users.household_id` references a household) share ONE
-- active shopping list. This migration:
--   1. creates `households` + `household_invites`, adds `shopping_lists.household_id`, and adds the
--      `users.household_id` FK (the column already existed as a bare uuid);
--   2. enables RLS + grants to the `grocery_app` role (the runtime, non-owner login);
--   3. REPLACES the shopping_lists / shopping_list_items policies with COMMAND-SPECIFIC ones so a
--      household member can READ a row whose household matches theirs, while WRITES stay constrained to
--      rows the member owns (and may only carry the member's OWN household / NULL) — see the long note
--      above the policies for why a single OR'd WITH CHECK would open a cross-tenant write hole.
--
-- Why the flag-off path is a strict no-op (NO RLS regression): with the flag off no household is ever
-- created, so every existing list keeps household_id = NULL and `users.household_id` stays NULL. The
-- added household branch (`household_id = <my household>`) reads a NULL household for such users, and
-- `<anything> = NULL` is never true — so for them the SELECT policy collapses to `user_id =
-- app_current_user_id()` (the original read rule) and the INSERT/UPDATE WITH CHECK collapses to
-- `user_id = app_current_user_id() AND household_id IS NULL`, which is exactly what every per-user
-- write already produces today (the column is new and defaults to NULL). Results are identical to today.
-- ===========================================================================

-- 1. Tables (idempotent). FKs mirror schema.ts.
CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Household',
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  accepted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS household_invite_household_idx ON household_invites (household_id);

-- users.household_id predates `households` (bare uuid in 0000). Add the FK now, idempotently.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_constraint WHERE conname = 'users_household_id_households_id_fk'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_household_id_households_id_fk
      FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL;
  END IF;
END $$;

-- shopping_lists gains the shared-household pointer (NULL ⇒ solo list, the existing behavior).
ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS shopping_list_household_idx ON shopping_lists (household_id);

-- 2. Grants to the runtime app role (matches step 1 of 0002_rls.sql; that ALL TABLES grant only
--    covered tables that existed when it ran, so grant the new ones explicitly + idempotently).
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'grocery_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON households TO grocery_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON household_invites TO grocery_app;
  END IF;
END $$;

-- A note on the policy SHAPE below. We deliberately use COMMAND-SPECIFIC policies (FOR SELECT /
-- INSERT / UPDATE / DELETE) rather than one FOR ALL policy with a permissive OR. The reason is a real
-- cross-tenant write hole that a single OR'd WITH CHECK opens: a WITH CHECK of the form
-- `user_id = me OR household_id = my_household` is satisfied by the `user_id = me` branch ALONE, so a
-- member could INSERT/UPDATE a row carrying ANOTHER household's id (`{user_id: me, household_id: B}`)
-- and have it land in household B's shared view. The fixes:
--   • a WRITE (INSERT/UPDATE) may only produce a row OWNED by the writer (user_id = me) AND whose
--     household is the writer's own (or NULL) — `household_id IS NULL OR household_id = my_household`;
--   • a DELETE is constrained to rows the writer OWNS / administers (DELETE has no WITH CHECK, so its
--     USING is the only guard — a permissive member-OR branch there would let any member destroy
--     shared/peer rows).
-- SELECT keeps the permissive "owner/member can read" branch so the sharing actually works.
-- The household subquery `(SELECT u.household_id FROM users u WHERE u.id = app_current_user_id())` is
-- NULL for solo users (and everyone when the flag is off), and `<col> = NULL` is never TRUE, so all of
-- these collapse to the original `user_id = app_current_user_id()` rule for them — the flag-off no-op.

-- 3a. households: any member reads; only the OWNER inserts/updates/deletes (members must never be able
--     to rename or DELETE the household — DELETE would cascade invites + detach every member's list).
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON households;          -- legacy single-policy name (idempotent)
DROP POLICY IF EXISTS households_select ON households;
DROP POLICY IF EXISTS households_insert ON households;
DROP POLICY IF EXISTS households_update ON households;
DROP POLICY IF EXISTS households_delete ON households;
CREATE POLICY households_select ON households FOR SELECT TO grocery_app
  USING (
    owner_user_id = app_current_user_id()
    OR id = (SELECT u.household_id FROM users u WHERE u.id = app_current_user_id())
  );
CREATE POLICY households_insert ON households FOR INSERT TO grocery_app
  WITH CHECK (owner_user_id = app_current_user_id());
CREATE POLICY households_update ON households FOR UPDATE TO grocery_app
  USING (owner_user_id = app_current_user_id())
  WITH CHECK (owner_user_id = app_current_user_id());
CREATE POLICY households_delete ON households FOR DELETE TO grocery_app
  USING (owner_user_id = app_current_user_id());

-- 3b. household_invites: members read; only the creator mints invites (and strictly for their OWN
--     household); the creator OR the household owner may revoke (DELETE). UPDATE is creator-only.
--     (Accepting an invite is done out-of-band on the ADMIN connection after validating the token —
--      the invitee is not yet a member and cannot be covered by RLS; mirrors the cookbook-token path.)
ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON household_invites;   -- legacy single-policy name (idempotent)
DROP POLICY IF EXISTS household_invites_select ON household_invites;
DROP POLICY IF EXISTS household_invites_insert ON household_invites;
DROP POLICY IF EXISTS household_invites_update ON household_invites;
DROP POLICY IF EXISTS household_invites_delete ON household_invites;
CREATE POLICY household_invites_select ON household_invites FOR SELECT TO grocery_app
  USING (
    created_by_user_id = app_current_user_id()
    OR household_id = (SELECT u.household_id FROM users u WHERE u.id = app_current_user_id())
  );
CREATE POLICY household_invites_insert ON household_invites FOR INSERT TO grocery_app
  WITH CHECK (
    created_by_user_id = app_current_user_id()
    AND household_id = (SELECT u.household_id FROM users u WHERE u.id = app_current_user_id())
  );
CREATE POLICY household_invites_update ON household_invites FOR UPDATE TO grocery_app
  USING (created_by_user_id = app_current_user_id())
  WITH CHECK (
    created_by_user_id = app_current_user_id()
    AND household_id = (SELECT u.household_id FROM users u WHERE u.id = app_current_user_id())
  );
CREATE POLICY household_invites_delete ON household_invites FOR DELETE TO grocery_app
  USING (
    created_by_user_id = app_current_user_id()
    OR EXISTS (SELECT 1 FROM households h
               WHERE h.id = household_invites.household_id AND h.owner_user_id = app_current_user_id())
  );

-- 3c. shopping_lists: members READ the shared list (own row OR a row in their household). A WRITE must
--     yield a row OWNED by the writer whose household is their own (or NULL) — this is what closes the
--     cross-household plant/move hole. DELETE is restricted to the row's owner (the list creator), so a
--     member cannot delete a peer's / the shared list out from under the household.
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON shopping_lists;      -- replaces the 0002 per-user policy
DROP POLICY IF EXISTS shopping_lists_select ON shopping_lists;
DROP POLICY IF EXISTS shopping_lists_insert ON shopping_lists;
DROP POLICY IF EXISTS shopping_lists_update ON shopping_lists;
DROP POLICY IF EXISTS shopping_lists_delete ON shopping_lists;
CREATE POLICY shopping_lists_select ON shopping_lists FOR SELECT TO grocery_app
  USING (
    user_id = app_current_user_id()
    OR household_id = (SELECT u.household_id FROM users u WHERE u.id = app_current_user_id())
  );
CREATE POLICY shopping_lists_insert ON shopping_lists FOR INSERT TO grocery_app
  WITH CHECK (
    user_id = app_current_user_id()
    AND (
      household_id IS NULL
      OR household_id = (SELECT u.household_id FROM users u WHERE u.id = app_current_user_id())
    )
  );
CREATE POLICY shopping_lists_update ON shopping_lists FOR UPDATE TO grocery_app
  USING (
    user_id = app_current_user_id()
    OR household_id = (SELECT u.household_id FROM users u WHERE u.id = app_current_user_id())
  )
  WITH CHECK (
    user_id = app_current_user_id()
    AND (
      household_id IS NULL
      OR household_id = (SELECT u.household_id FROM users u WHERE u.id = app_current_user_id())
    )
  );
CREATE POLICY shopping_lists_delete ON shopping_lists FOR DELETE TO grocery_app
  USING (user_id = app_current_user_id());

-- 3d. shopping_list_items: ownership is transitive through the parent list — a member can read/write
--     items on any list they can reach (own list OR their household's shared list). This is safe now
--     that the parent policy (3c) forbids a `user_id = me` list from carrying a foreign household_id:
--     the only lists with `l.user_id = me` are the writer's own (solo or their-household), so an item
--     can never be attached to another household's list. Same NULL-collapse keeps solo users unchanged.
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON shopping_list_items;
CREATE POLICY tenant_isolation ON shopping_list_items TO grocery_app
  USING (EXISTS (
    SELECT 1 FROM shopping_lists l
    WHERE l.id = shopping_list_items.shopping_list_id
      AND (
        l.user_id = app_current_user_id()
        OR l.household_id = (SELECT u.household_id FROM users u WHERE u.id = app_current_user_id())
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM shopping_lists l
    WHERE l.id = shopping_list_items.shopping_list_id
      AND (
        l.user_id = app_current_user_id()
        OR l.household_id = (SELECT u.household_id FROM users u WHERE u.id = app_current_user_id())
      )
  ));
