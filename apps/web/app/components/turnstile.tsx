"use client";

import { useEffect, useRef, useState } from "react";

/**
 * G5: Cloudflare Turnstile widget (client side).
 *
 * The server actions on /signup and the waitlist call `verifyTurnstile()` which reads the
 * `cf-turnstile-response` token. That token only exists if a widget actually RENDERS in the
 * browser — without this component the token is always null, so once the owner sets the secret
 * key in production `verifyTurnstile()` rejects every submission and signup/waitlist break.
 *
 * Behaviour mirrors the server's fail-open contract:
 *   - No `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` (dev/staging) ⇒ render nothing. The server's
 *     `verifyTurnstile()` skips verification when its secret key is also absent, so the form works.
 *   - Site key present ⇒ load Cloudflare's script, render the widget, and expose the token to the
 *     enclosing form via a hidden `cf-turnstile-response` input (native form posts pick it up) AND
 *     via the optional `onToken` callback (for forms that submit through a JS handler / server action).
 *
 * We disable Cloudflare's own injected response field (`response-field: false`) so there is exactly
 * ONE `cf-turnstile-response` input — the React-controlled one below — never a duplicate.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      "response-field"?: boolean;
      theme?: "auto" | "light" | "dark";
      action?: string;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function ensureScript(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
  const script = document.createElement("script");
  script.src = SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

/**
 * Renders the Turnstile challenge. `action` lets Cloudflare analytics distinguish surfaces
 * (e.g. "signup" vs "waitlist"). Returns null (and renders nothing) when no site key is configured.
 */
export function Turnstile({
  onToken,
  action,
}: {
  onToken?: (token: string) => void;
  action?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;

    function renderWidget() {
      if (cancelled || widgetIdRef.current || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY as string,
        action,
        "response-field": false,
        callback: (t: string) => {
          setToken(t);
          onTokenRef.current?.(t);
        },
        "error-callback": () => {
          setToken("");
          onTokenRef.current?.("");
        },
        "expired-callback": () => {
          setToken("");
          onTokenRef.current?.("");
          if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
        },
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      ensureScript();
      // The script loads async; poll briefly until the global API is ready, then render once.
      pollId = setInterval(() => {
        if (window.turnstile) {
          if (pollId) clearInterval(pollId);
          pollId = null;
          renderWidget();
        }
      }, 200);
    }

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      const id = widgetIdRef.current;
      widgetIdRef.current = null;
      if (id && window.turnstile) {
        try {
          window.turnstile.remove(id);
        } catch {
          /* widget already gone — nothing to clean up */
        }
      }
    };
  }, [action]);

  if (!SITE_KEY) return null;

  return (
    <div>
      <div ref={containerRef} />
      <input type="hidden" name="cf-turnstile-response" value={token} readOnly />
    </div>
  );
}
