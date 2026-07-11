"use server";

import { signOut } from "@/auth";
import { currentSession } from "./tenant";

/**
 * End any persisted session and send the user to /signin — called by the LaunchGuard on a fresh app
 * launch so a session is NEVER silently resumed (login required every launch). We check the session
 * HERE (not in the root layout) so the layout stays free of cookies()/auth(), which would break the
 * static /404 build. No session ⇒ cheap no-op (a logged-out visitor on the landing isn't disturbed).
 * `signOut` throws NEXT_REDIRECT, which must propagate for the navigation to happen.
 */
export async function forceSignOutAction() {
  // `currentSession()` NEVER throws — a corrupt/undecryptable session cookie (e.g. after an
  // AUTH_SECRET rotation) must degrade to the cheap no-op, not crash the LaunchGuard that runs this
  // on every app launch. This wraps ONLY the session READ; `signOut`'s NEXT_REDIRECT still throws
  // from the line below and propagates for the navigation to happen (an inert corrupt cookie can't
  // authenticate anyway, so skipping signOut is safe).
  const session = await currentSession();
  if (session?.user) await signOut({ redirectTo: "/signin" });
}
