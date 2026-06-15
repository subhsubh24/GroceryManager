-- Supplements vertical + dosage-based depletion (PLAN §7.5 / §6). Idempotent.

-- New domain value (routes to the Amazon channel like household/personal_care).
ALTER TYPE "domain" ADD VALUE IF NOT EXISTS 'supplement';

-- Product attribute: units per retail package (e.g. 60 capsules/bottle).
ALTER TABLE canonical_items ADD COLUMN IF NOT EXISTS units_per_package numeric(12,3);

-- Per-user dosage: how many base units consumed per day (e.g. 2 capsules/day).
ALTER TABLE reorder_policies ADD COLUMN IF NOT EXISTS doses_per_day numeric(12,3);
