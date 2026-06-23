"use client";

import { useEffect, useTransition } from "react";
import { forceSignOutAction } from "@/app/lib/session-actions";

const KEY = "gm:launched";

/**
 * Require an explicit login on EVERY fresh launch — a persisted session is never silently resumed.
 *
 * `sessionStorage` is scoped to the browsing session: it's cleared when the tab or installed PWA is
 * closed, but it survives in-session navigations. So on the first load of a new session we set a
 * marker and — if a session cookie is still hanging around (`authed`) — sign it out and route to
 * /signin. After the user logs in (same session), the marker is already set, so moving between
 * screens never signs them out. Storage blocked → do nothing (never risk a sign-out loop).
 *
 * Rendered once from the root layout; renders nothing.
 */
export function LaunchGuard() {
  const [, startTransition] = useTransition();
  useEffect(() => {
    let fresh = false;
    try {
      fresh = sessionStorage.getItem(KEY) === null;
      sessionStorage.setItem(KEY, "1");
    } catch {
      return; // storage unavailable — don't risk repeatedly signing the user out
    }
    // On the first load of a new browser session, end any lingering server session. The action checks
    // the session itself, so this is a no-op when already signed out (e.g. a visitor on the landing).
    if (fresh) startTransition(() => void forceSignOutAction());
  }, [startTransition]);
  return null;
}
