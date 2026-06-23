-- 0009 — SMS digest channel: an optional phone number on the user. Presence = opted in to texts;
-- clearing it opts out. Idempotent + additive (no data change). RLS already covers `users` (the
-- existing tenant policy on id), so no policy change is needed for a new column.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
