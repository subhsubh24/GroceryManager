import { NextResponse } from "next/server";
import { getPantryView, withTenant, getDb } from "@gm/db";
import { getMobileUserId } from "../lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await withTenant(getDb(), userId, (tx) =>
    getPantryView(tx, userId),
  );
  return NextResponse.json({ items });
}
