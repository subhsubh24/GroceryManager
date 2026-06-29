-- 0020 — Cohort-retention DATA SOURCE supporting indexes (H11). All idempotent (IF NOT EXISTS),
-- plain btree, purely additive (no data change), so this is safe to (re)run anytime.
--
-- The cohort-retention aggregate (packages/db/src/queries/cohort-retention.ts) scans meal_logs by
-- user_id and buckets cooked_at into weeks. A composite (user_id, cooked_at) index lets the activity
-- CTE answer "this user's distinct active weeks" from the index alone, keeping the admin/cron
-- analytics aggregate cheap as cook history grows. Complements the plain meal_logs_user_idx (0008).
CREATE INDEX IF NOT EXISTS meal_logs_user_cooked_at_idx ON meal_logs (user_id, cooked_at);

-- The cohort CTE filters users by created_at (last ~12 signup weeks) and buckets into weeks; an index
-- on created_at avoids a full users scan for that bounded window.
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at);
