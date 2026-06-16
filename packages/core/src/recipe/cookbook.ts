/**
 * "My Cookbook" — pure helpers for the personal saved-recipe collection (PLAN §10 growth).
 *
 * Saved recipes ride the append-only PreferenceSignal ledger (no new table): each save is a
 * `saved_recipe` signal whose `value` is the JSON below, and each unsave deletes the matching row.
 * Because saves are appended, the read path must dedupe by id (latest wins) — hence `dedupeSaved`.
 *
 * Pure + testable; no key, no I/O. The DB-touching save/load helpers live in @gm/db.
 */
export type SavedRecipe = { id: string; title: string; imageUrl?: string; cuisine?: string };

/** Serialize the 4 fields to the canonical ledger `value` string. */
export function encodeSaved(r: SavedRecipe): string {
  return JSON.stringify({ id: r.id, title: r.title, imageUrl: r.imageUrl, cuisine: r.cuisine });
}

/** Safe parse of a ledger `value` back into a SavedRecipe; null if invalid or missing id/title. */
export function decodeSaved(value: string): SavedRecipe | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  const id = o.id;
  const title = o.title;
  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof title !== "string" || title.length === 0) return null;
  const imageUrl = typeof o.imageUrl === "string" && o.imageUrl ? o.imageUrl : undefined;
  const cuisine = typeof o.cuisine === "string" && o.cuisine ? o.cuisine : undefined;
  return { id, title, imageUrl, cuisine };
}

/**
 * Decode ledger rows → SavedRecipe[], dropping unparseable rows, deduping by id (keeping the most
 * recent occurrence), sorted newest-first. Appended saves mean an id can appear many times; the
 * latest `occurredAt` is authoritative for both dedup and ordering.
 */
export function dedupeSaved(rows: { value: string; occurredAt: Date }[]): SavedRecipe[] {
  const byId = new Map<string, { recipe: SavedRecipe; occurredAt: Date }>();
  for (const row of rows) {
    const recipe = decodeSaved(row.value);
    if (!recipe) continue;
    const prev = byId.get(recipe.id);
    if (!prev || row.occurredAt.getTime() > prev.occurredAt.getTime()) {
      byId.set(recipe.id, { recipe, occurredAt: row.occurredAt });
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .map((e) => e.recipe);
}
