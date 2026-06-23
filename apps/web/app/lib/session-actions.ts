"use server";

import { auth, signOut } from "@/auth";

/**
 * End any persisted session and send the user to /signin — called by the LaunchGuard on a fresh app
 * launch so a session is NEVER silently resumed (login required every launch). We check the session
 * HERE (not in the root layout) so the layout stays free of cookies()/auth(), which would break the
 * static /404 build. No session ⇒ cheap no-op (a logged-out visitor on the landing isn't disturbed).
 * `signOut` throws NEXT_REDIRECT, which must propagate for the navigation to happen.
 */
export async function forceSignOutAction() {
  const session = await auth();
  if (session?.user) await signOut({ redirectTo: "/signin" });
}
