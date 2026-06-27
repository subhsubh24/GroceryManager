import { timingSafeEqual } from "crypto";
import { getAdminDb, getContentSchedule, markContentPublished, markContentSkipped } from "@gm/db";
import { getDueItems, publishItem } from "@gm/core/content/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron endpoint that reads due content_schedule items and publishes them.
 * Protected by CRON_SECRET (Bearer token in Authorization header).
 * Schedule in vercel.json, e.g.:
 *   { "path": "/api/cron/publish", "schedule": "* * * * *" }
 */
export async function GET(req: Request) {
  // 1. Validate CRON_SECRET
  const secret = process.env["CRON_SECRET"];
  if (secret) {
    const authHeader = req.headers.get("authorization");
    const expected = `Bearer ${secret}`;
    const isAuthorized = (() => {
      if (!authHeader) return false;
      const ab = Buffer.from(authHeader, "utf8");
      const bb = Buffer.from(expected, "utf8");
      return ab.length === bb.length && timingSafeEqual(ab, bb);
    })();
    if (!isAuthorized) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("[cron/publish] CRON_SECRET is not set — allowing unauthenticated access");
  }

  // 2. Get admin DB and fetch due content schedule items
  const db = getAdminDb();
  const items = await getContentSchedule(db, "scheduled");
  if (items === null) {
    return Response.json({ processed: 0, published: 0, skipped: 0, note: "migration-pending" });
  }

  // 3. Filter to due items — map snake_case DB fields to camelCase scheduler interface
  const now = new Date();
  const mappedItems = items.map((item) => ({
    ...item,
    scheduledAt: item.scheduled_at,
    status: item.status as "draft" | "scheduled" | "published" | "skipped",
  }));
  const dueItems = getDueItems(mappedItems, now);

  // 4. Publish each due item best-effort
  let published = 0;
  let skipped = 0;

  for (const item of dueItems) {
    try {
      const result = await publishItem(item);
      if (result.published) {
        await markContentPublished(db, item.id, new Date());
        published++;
      } else if (result.skipped) {
        await markContentSkipped(db, item.id, result.reason ?? "skipped");
        skipped++;
      } else {
        await markContentSkipped(db, item.id, result.reason ?? "error");
        skipped++;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[cron/publish] item ${item.id} failed:`, reason);
      try {
        await markContentSkipped(db, item.id, reason);
      } catch (markErr) {
        console.error(`[cron/publish] failed to mark item ${item.id} as skipped:`, markErr);
      }
      skipped++;
    }
  }

  // 5. Return summary
  return Response.json({ processed: dueItems.length, published, skipped });
}
