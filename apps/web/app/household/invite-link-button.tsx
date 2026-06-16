"use client";

import { useState, useTransition } from "react";
import { createInviteLinkAction } from "./actions";

/**
 * "Invite a member" — mints a fresh, unguessable join link to the user's household and reveals it. On
 * reveal it offers the native share sheet (`navigator.share`); the link is always shown with a Copy
 * button as the fallback. Resilient: a null result (signed-out / DB hiccup / flag off) shows a gentle
 * inline message rather than throwing. Mirrors cookbook/share-cookbook-button.tsx.
 */
export function InviteLinkButton() {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function onCreate() {
    setFailed(false);
    startTransition(async () => {
      const res = await createInviteLinkAction();
      if (!res.url) {
        setFailed(true);
        return;
      }
      setUrl(res.url);
      // Offer the native share sheet on first reveal; ignore dismissal/blocking.
      try {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ title: "Join my GroceryManager household", url: res.url });
        }
      } catch {
        /* dismissed or blocked — the copy fallback below still works */
      }
    });
  }

  async function onCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is selectable in the field */
    }
  }

  if (!url) {
    return (
      <div className="flex flex-col items-start gap-1">
        <button type="button" onClick={onCreate} disabled={pending} className="btn-primary disabled:opacity-50">
          {pending ? "Creating link…" : "Create invite link"}
        </button>
        {failed && (
          <p className="text-xs text-ink-400">Couldn&apos;t create an invite link just now — please try again.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <input
        type="text"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Invite link to your household"
        className="input flex-1 text-xs"
      />
      <button type="button" onClick={onCopy} className="btn-secondary btn-sm shrink-0">
        {copied ? "Copied ✓" : "Copy link"}
      </button>
    </div>
  );
}
