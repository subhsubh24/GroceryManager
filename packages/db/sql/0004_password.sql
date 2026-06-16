-- Email + password login (PLAN §8.7 — login moved off Google; Google stays for Gmail connect).
-- Nullable: Google-only accounts (and pre-existing rows) have no password. Idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
