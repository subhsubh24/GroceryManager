import type { Session } from "next-auth";
import { isUuid } from "@gm/core/security/uuid";
import { auth } from "@/auth";

/**
 * The current session, or null — NEVER throws. `auth()` can throw (not just return null): a session
 * cookie that can't be decrypted (e.g. after an `AUTH_SECRET` rotation, or a stale/corrupt cookie)
 * raises a JWT/decryption error. Calling `auth()` directly in a Server Component therefore crashes
 * the whole page → the route error boundary ("Couldn't load your dashboard"), even though the right
 * behavior is just to treat the request as signed-out (render the logged-out view / let the user
 * re-auth). Use this everywhere a page render reads the session.
 */
export async function currentSession(): Promise<Session | null> {
  try {
    return (await auth()) as Session | null;
  } catch {
    return null;
  }
}

/**
 * The signed-in user's id for RLS scoping (PLAN §11). Null when not authenticated — every app route
 * is gated by `middleware.ts`, so pages/actions only ever run for a real session, and each person's
 * data is isolated to their own account. Callers run their queries inside `withTenant(getDb(), …)`.
 *
 * The id MUST be a UUID: it flows into the `app.current_user_id` GUC, which RLS casts to `uuid`.
 * A session whose `uid` isn't a UUID (a stale/forged/legacy token) would otherwise make every
 * tenant query throw `invalid input syntax for type uuid` and 500 the whole page subtree. Treating
 * a non-UUID session as signed-out turns that crash into a clean logged-out render / sign-in.
 */
export async function currentUserId(): Promise<string | null> {
  try {
    const session = await auth();
    const id = (session?.user as { id?: string } | undefined)?.id;
    return isUuid(id) ? id : null;
  } catch {
    // Auth not configured (e.g. local dev without AUTH_SECRET) — treat as signed-out.
    return null;
  }
}
