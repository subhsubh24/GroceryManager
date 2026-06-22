/**
 * One-off backfill: classify canonical items that ingestion created BEFORE shelf-life estimation
 * existed (no category, no shelf life — so the depletion engine couldn't age them and they read
 * "in stock" forever), then re-project EVERY pantry row so on-hand reflects cadence + spoilage as of
 * today. Idempotent + safe to re-run. Run once after deploying the shelf-life change:
 *   DATABASE_URL=… pnpm --filter @gm/workers backfill:shelf-life
 * Uses the admin (owner) connection so it can write the shared catalog + reproject across tenants.
 */
import {
  getAdminDb,
  listAllPantryStockUserItems,
  listCanonicalItemsToClassify,
  setCanonicalClassification,
} from "@gm/db";
import { estimateShelfLife, reprojectStock } from "@gm/core/pantry";

async function main() {
  const db = getAdminDb();

  // 1) Give unclassified items a perishability + shelf life + domain from the name heuristic.
  const items = await listCanonicalItemsToClassify(db);
  console.log(`→ classifying ${items.length} unclassified item(s)…`);
  let classified = 0;
  for (const it of items) {
    try {
      await setCanonicalClassification(db, it.id, estimateShelfLife(it.name));
      classified++;
    } catch (e) {
      console.error(`  ✗ ${it.name}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`✓ classified ${classified}/${items.length}`);

  // 2) Re-project every pantry row so the new shelf life + learned cadence age stock to "today".
  const keys = await listAllPantryStockUserItems(db);
  console.log(`→ re-projecting ${keys.length} pantry row(s)…`);
  let reprojected = 0;
  for (const k of keys) {
    try {
      await reprojectStock(db, k.userId, k.canonicalItemId, null);
      reprojected++;
    } catch (e) {
      console.error(`  ✗ ${k.canonicalItemId}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`✓ re-projected ${reprojected}/${keys.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
