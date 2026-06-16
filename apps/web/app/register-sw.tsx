"use client";

import { useEffect } from "react";

/** Register the service worker on load so the app works offline (PLAN §10) and is push-ready. */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
