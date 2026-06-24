"use server";

import { getAdminDb, insertWaitlistEmail } from "@gm/db";

export async function submitWaitlistEmail(email: string): Promise<void> {
  if (typeof email !== "string" || email.length > 254 || !email.includes("@")) return;

  // Persist to DB (requires migration 0012 — see PENDING_OPS.md). Falls back to console
  // logging if the table doesn't exist yet (safe on first deploy before migration is applied).
  try {
    // waitlist_submissions has no RLS; getAdminDb() is intentional (tenant-free table).
    await insertWaitlistEmail(getAdminDb(), email);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const tableMissing = msg.includes("waitlist_submissions") && msg.includes("does not exist");
    console.warn(`[waitlist] insert failed table_missing=${tableMissing} ts=${new Date().toISOString()}`);
  }
}
