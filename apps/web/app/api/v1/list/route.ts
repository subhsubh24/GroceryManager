import { NextResponse } from "next/server";
import { getActiveListView, withTenant, getDb } from "@gm/db";
import { getMobileUserId } from "../lib/mobile-auth";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`v1-list-read:${userId}`, 60, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const items = await withTenant(getDb(), userId, (tx) =>
    getActiveListView(tx, userId),
  );
  return NextResponse.json({ items });
}
