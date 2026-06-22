"use server";

import { signOut } from "@/auth";

/**
 * Sign the user out and send them to /signin. Called by the LaunchGuard on a fresh app launch so a
 * persisted session is NEVER silently resumed (login is required every time the app is opened).
 * `signOut` throws NEXT_REDIRECT, which must propagate for the navigation to happen.
 */
export async function forceSignOutAction() {
  await signOut({ redirectTo: "/signin" });
}
