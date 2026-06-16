/**
 * One-off backfill: embed every canonical item that lacks an embedding, so the §5.4 semantic match
 * stage has candidates to compare against. Run after seeding / adding catalog items:
 *   GEMINI_API_KEY=… DATABASE_URL=… pnpm --filter @gm/workers backfill:embeddings
 * Uses the admin (owner) connection so it can write the shared catalog.
 */
import { getAdminDb, listItemsNeedingEmbedding, setItemEmbedding } from "@gm/db";
import { createGeminiEmbedder } from "@gm/core/llm";

async function main() {
  const db = getAdminDb();
  const embed = createGeminiEmbedder();

  const rows = await listItemsNeedingEmbedding(db);
  console.log(`→ embedding ${rows.length} catalog item(s) with no vector…`);
  let done = 0;
  for (const r of rows) {
    try {
      await setItemEmbedding(db, r.id, await embed(r.name));
      done++;
    } catch (e) {
      console.error(`  ✗ ${r.name}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`✓ embedded ${done}/${rows.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
