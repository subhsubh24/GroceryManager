"use client";

import { useEffect, useState } from "react";

// `beforeinstallprompt` and `navigator.standalone` aren't in TS's lib.dom — narrow them locally and
// feature-detect at runtime (same precedent as cook-mode's Wake Lock typing). No `any`, no new deps.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}
type StandaloneNavigator = Navigator & { standalone?: boolean };

const DISMISS_KEY = "gm:install-dismissed";
const READY_EVENT = "gm:installable";

// Chromium fires the one-shot `beforeinstallprompt` early in page load — often before React hydrates
// and the component's effect can subscribe, and the event is never re-dispatched. So we capture it at
// module-eval time (this "use client" module is imported as part of the initial bundle, ahead of the
// effect), stash it, and re-emit a custom event. The component reads the stash on mount (covers the
// already-fired case) AND listens for the custom event (covers the not-yet-fired case).
let stashedPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault(); // stop Chrome's default mini-infobar; we surface our own affordance
    stashedPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(READY_EVENT));
  });
}

/** True when the app is already running installed (Android/desktop display-mode or iOS standalone). */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  return mql || (navigator as StandaloneNavigator).standalone === true;
}

/** iOS Safari has no `beforeinstallprompt`, so detect it to show a manual "Add to Home Screen" hint. */
function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua); // Chrome/FF/Edge/Opera on iOS
  return iOS && webkit && !otherBrowser;
}

/**
 * Tasteful, dismissible PWA install affordance (PLAN §10). Rendered globally from the root layout;
 * SSR-safe (renders nothing until mounted) and only appears when actually installable:
 *   - Chromium: captures `beforeinstallprompt`, stashes it, and shows an "Install app" button that
 *     calls `prompt()` on click.
 *   - iOS Safari: shows a manual "Add to Home Screen" hint (no programmatic prompt exists).
 * Hidden when already installed or previously dismissed (persisted in localStorage). Slim bottom
 * banner, sat above the mobile BottomNav, with no layout shift.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true); // default hidden until we know it's relevant

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* storage blocked — treat as not dismissed */
    }
    setDismissed(false);

    // Pick up an event that already fired (captured at module load) before this effect ran…
    if (stashedPrompt) setDeferred(stashedPrompt);
    // …and react to one that fires later.
    const onReady = () => {
      if (stashedPrompt) setDeferred(stashedPrompt);
    };
    window.addEventListener(READY_EVENT, onReady);

    // No install event on iOS Safari — fall back to the manual hint.
    if (isIosSafari()) setIosHint(true);

    return () => window.removeEventListener(READY_EVENT, onReady);
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    const evt = deferred;
    if (!evt) return;
    setDeferred(null);
    stashedPrompt = null; // consumed — prompt() may only be called once
    try {
      await evt.prompt();
      await evt.userChoice;
    } catch {
      /* user dismissed the native sheet — nothing to do */
    }
    dismiss(); // either way, don't nag again this device
  }

  // Render nothing during SSR / when not relevant — avoids hydration mismatch and layout shift.
  if (dismissed) return null;
  if (!deferred && !iosHint) return null;

  return (
    <div className="fixed inset-x-0 bottom-36 z-50 px-4 md:inset-x-auto md:bottom-20 md:right-4 md:px-0">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-lift backdrop-blur-xl md:mx-0 md:ml-auto">
        <span className="tile h-9 w-9 shrink-0 text-lg">🧺</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink-900">Install GroceryManager</div>
          <div className="truncate text-xs text-ink-500">
            {iosHint
              ? "Tap the Share button, then “Add to Home Screen”."
              : "Add it to your home screen — works offline."}
          </div>
        </div>
        {deferred && (
          <button type="button" onClick={install} className="btn-primary btn-sm shrink-0">
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          title="Dismiss"
          className="btn-ghost btn-sm shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
