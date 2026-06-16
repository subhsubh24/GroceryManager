import { auth } from "@/auth";

/**
 * The signed-in user's id for RLS scoping (PLAN §11). Null when not authenticated — every app route
 * is gated by `middleware.ts`, so pages/actions only ever run for a real session, and each person's
 * data is isolated to their own account. Callers run their queries inside `withTenant(getDb(), …)`.
 */
export async function currentUserId(): Promise<string | null> {
  try {
    const session = await auth();
    return (session?.user as { id?: string } | undefined)?.id ?? null;
  } catch {
    // Auth not configured (e.g. local dev without AUTH_SECRET) — treat as signed-out.
    return null;
  }
}
