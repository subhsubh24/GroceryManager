import { NextResponse } from "next/server";
import { getPantryView, withTenant, getDb } from "@gm/db";
import { getMobileUserId } from "../lib/mobile-auth";
import { serverError } from "../../_lib/guard";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`v1-pantry-read:${userId}`, 60, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  try {
    const items = await withTenant(getDb(), userId, (tx) =>
      getPantryView(tx, userId),
    );
    return NextResponse.json({ items });
  } catch (err) {
    // Don't let a transient DB failure escape as an uncaught 500 with a stack (G3 error-hygiene).
    return serverError("v1/pantry", err);
  }
}
