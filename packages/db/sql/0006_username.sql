-- Username login (PLAN §8.7 refinement): the credentials identifier is now a USERNAME, not an email.
-- Email becomes OPTIONAL — it's set only when a user connects Gmail (from the Google profile), never
-- collected at signup. Idempotent.

-- 1) Add the handle (nullable: a Google-keyed row could exist without one).
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;

-- 2) Backfill existing rows from the email local-part so no account is stranded. Sanitize to the
--    allowed charset and suffix duplicates (window row-number) so the unique index below holds.
UPDATE users u
SET username = base.uname
FROM (
  SELECT id,
    coalesce(nullif(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._]', '', 'g'), ''), 'user')
      || CASE WHEN rn > 1 THEN rn::text ELSE '' END AS uname
  FROM (
    SELECT id,
      row_number() OVER (
        PARTITION BY coalesce(nullif(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._]', '', 'g'), ''), 'user')
        ORDER BY created_at, id
      ) AS rn
    FROM users
    WHERE username IS NULL AND email IS NOT NULL
  ) s
) AS base
WHERE u.id = base.id;

-- 3) Unique handle. Postgres treats NULLs as distinct, so Google-only rows without one are fine.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (username);

-- 4) Email is no longer required (credentials signup collects only a username now).
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
