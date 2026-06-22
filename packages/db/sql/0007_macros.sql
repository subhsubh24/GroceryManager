-- Stored macros on cook logs (cook-logging with stored macros). At log time we compute the meal's
-- calories + protein/carbs/fat from USDA FoodData Central (primary) with an LLM fallback, and persist
-- them here so the cook-log view + daily totals read straight from the row. All nullable (estimation
-- is best-effort) and never block logging a cook. macros_source records provenance: fdc|llm|mixed|none.
-- Idempotent.

ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS kcal real;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS protein_g real;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS carbs_g real;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS fat_g real;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS macros_source text;
