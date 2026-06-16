/**
 * Backfill the pantry from receipt history for every connected user (PLAN §10). Unbounded vs. the
 * web button — run it once after a user connects Gmail to seed months of history:
 *   GEMINI_API_KEY=… DATABASE_URL=… pnpm --filter @gm/workers backfill:receipts [sinceDays] [cap]
 */
import { loadEnv } from "@gm/config/env";
import { getAdminDb, getDb, listGoogleUserIds } from "@gm/db";
import { backfillGmailForUser } from "@gm/core/ingestion";

async function main() {
  const env = loadEnv();
  const sinceDays = Number(process.argv[2] ?? 180);
  const cap = Number(process.argv[3] ?? 500);
  const userIds = await listGoogleUserIds(getAdminDb());
  console.log(`→ backfilling ${userIds.length} user(s): last ${sinceDays}d, up to ${cap} each`);
  for (const userId of userIds) {
    try {
      const s = await backfillGmailForUser(getDb(), env, userId, { sinceDays, maxMessages: cap });
      console.log(`[backfill] ${userId}: ${s.ingested} new, ${s.deduped} seen, ${s.failed} failed`);
    } catch (e) {
      console.error(`[backfill] ${userId} failed`, e);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
