-- 0008 — performance indexes for hot per-user read paths. All idempotent (IF NOT EXISTS), plain
-- btree, purely additive (no data change), so this is safe to (re)run anytime.

-- The home page reads meal_logs by user on every load (cooking streak + weekly "wrapped" counts),
-- and so does the digest. Without this it's a sequential scan that grows with cook history.
CREATE INDEX IF NOT EXISTS meal_logs_user_idx ON meal_logs (user_id);

-- The home page + reorder/list views read the active shopping list by user on every load.
CREATE INDEX IF NOT EXISTS shopping_lists_user_idx ON shopping_lists (user_id);

-- The pantry "where did this come from" lookup and clearing a review group both filter purchase line
-- items by canonical item (the existing index only covers purchase_id).
CREATE INDEX IF NOT EXISTS lineitem_canonical_idx ON purchase_line_items (canonical_item_id);
