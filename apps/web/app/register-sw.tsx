"use client";

import { useEffect } from "react";

/**
 * Service worker lifecycle. Register it ONLY in production. In development a SW caches Next's dev
 * chunks cache-first and then serves them stale after any code change — the new HTML loads against old
 * JS, React can't hydrate, and every button goes dead (a hard reload doesn't help because the SW keeps
 * controlling the page). So in dev we instead UNREGISTER any existing SW and clear its caches, undoing
 * the damage left by a prior visit. Offline + push still work in production (PLAN §10).
 */
export function RegisterSW() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
      return;
    }

    // Dev: tear down any stale SW + caches so they can never serve an outdated bundle.
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }, []);
  return null;
}
