"use server";

import { getAdminDb, insertWaitlistEmail } from "@gm/db";

export async function submitWaitlistEmail(email: string): Promise<void> {
  // Persist to DB (requires migration 0012 — see PENDING_OPS.md). Falls back to console
  // logging if the table doesn't exist yet (safe on first deploy before migration is applied).
  try {
    await insertWaitlistEmail(getAdminDb(), email);
  } catch {
    // Table not yet created (pre-migration) — fall back to server log so no submission is lost.
    console.log(`[waitlist] ${new Date().toISOString()} email=${email}`);
  }
}
