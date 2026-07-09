"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, Loader2 } from "@/app/components/icons";
import { formatInviteCodeForDisplay, normalizeAndValidate } from "@gm/core/security/invite-code";
import { trackEvent } from "@/app/lib/plausible";

/**
 * Redeem a beta INVITE CODE (ROADMAP §34 Part B). Posts to the hardened `/api/invite/redeem`; on a
 * real server-confirmed success the endpoint grants the site-gate cookie, so we then continue to
 * `/signup`. SIDE-EFFECT INTEGRITY: we only advance on the server's `{ ok: true }` — never an
 * optimistic redirect — so a bad/expired code shows an honest inline error and goes nowhere.
 *
 * `?code=` (from the invite email's deep link) pre-fills the field but never auto-submits — the
 * person clicks to redeem, so we never fire a state-changing POST on page load.
 */
type State = "idle" | "submitting" | "ok" | "error";

export function JoinClient() {
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from the invite email's deep link (?code=…), formatted for readability, then STRIP the
  // code from the URL so a reusable beta key isn't retained in browser history or sent to analytics
  // on any later pageview. The code lives in component state from here; redemption is idempotent, so
  // dropping it from the URL is safe.
  useEffect(() => {
    const fromUrl = params.get("code");
    if (!fromUrl) return;
    const norm = normalizeAndValidate(fromUrl);
    setCode(norm ? formatInviteCodeForDisplay(norm) : fromUrl);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("code")) {
        url.searchParams.delete("code");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    } catch {
      /* non-critical — leave the URL as-is if history isn't available */
    }
  }, [params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "submitting") return;
    setError(null);

    // Client-side shape check first — instant feedback, and we never POST obvious junk.
    const canonical = normalizeAndValidate(code);
    if (!canonical) {
      setState("error");
      setError("That doesn't look like a valid code. Copy it exactly from your invite email.");
      return;
    }

    setState("submitting");
    try {
      const res = await fetch("/api/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: canonical }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; next?: string; error?: string };
      if (res.ok && data.ok) {
        setState("ok");
        trackEvent("invite_redeemed");
        // Server confirmed + granted the gate cookie → continue to signup.
        window.location.assign(typeof data.next === "string" ? data.next : "/signup?invited=1");
        return;
      }
      setState("error");
      setError(data.error ?? "That invite code isn't valid. Please try again.");
    } catch {
      setState("error");
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  const busy = state === "submitting" || state === "ok";

  return (
    <form onSubmit={submit} className="card card-pad">
      <label htmlFor="invite-code" className="block text-sm font-semibold text-ink-800">
        Invite code
      </label>
      <input
        id="invite-code"
        name="code"
        type="text"
        inputMode="text"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        spellCheck={false}
        autoFocus
        placeholder="XXXXX-XXXXX"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          if (state === "error") {
            setState("idle");
            setError(null);
          }
        }}
        aria-invalid={state === "error"}
        aria-describedby={error ? "invite-error" : undefined}
        className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-lg font-mono tracking-[0.15em] text-ink-900 shadow-xs transition placeholder:tracking-normal placeholder:text-ink-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />

      {error ? (
        <p id="invite-error" role="alert" className="mt-2 text-sm text-danger-ink">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="btn-primary mt-4 flex w-full items-center justify-center gap-2 disabled:opacity-70"
      >
        {state === "submitting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Redeeming…
          </>
        ) : state === "ok" ? (
          <>
            <Check className="h-4 w-4" aria-hidden />
            Invite accepted — taking you in…
          </>
        ) : (
          <>
            Redeem &amp; create account
            <ArrowRight className="h-4 w-4" aria-hidden />
          </>
        )}
      </button>
    </form>
  );
}
