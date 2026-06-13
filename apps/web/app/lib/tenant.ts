import { auth } from "@/auth";
import { getAdminDb, getLatestUserId } from "@gm/db";

/**
 * The current tenant's userId for RLS scoping (PLAN §11): from the NextAuth session when signed in,
 * else the demo "latest user" bootstrap on the admin connection (until auth gates the whole UI).
 * Callers then run their queries inside `withTenant(getDb(), userId, …)`.
 */
export async function currentUserId(): Promise<string | null> {
  try {
    const session = await auth();
    const uid = (session?.user as { id?: string } | undefined)?.id;
    if (uid) return uid;
  } catch {
    // Auth not configured (e.g. local dev without AUTH_SECRET) — fall back to the demo bootstrap.
  }
  return getLatestUserId(getAdminDb());
}
