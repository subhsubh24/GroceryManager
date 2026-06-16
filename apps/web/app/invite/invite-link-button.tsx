"use client";

import { useState } from "react";

/**
 * The personal invite link with a Copy button + native share sheet. The URL is computed server-side
 * (the invite page already resolved the code + origin) and passed in, so this is purely presentational
 * — no action round-trip. On Copy it writes to the clipboard; on Share it offers `navigator.share`
 * where available. Resilient: a blocked clipboard/share is swallowed (the link stays selectable in the
 * field). Mirrors cookbook/share-cookbook-button.tsx.
 */
export function InviteLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is selectable in the field */
    }
  }

  async function onShare() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Join me on GroceryManager", url });
      } else {
        await onCopy();
      }
    } catch {
      /* dismissed or blocked — the copy fallback still works */
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <input
        type="text"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Your personal invite link"
        className="input flex-1 text-xs"
      />
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={onCopy} className="btn-secondary btn-sm">
          {copied ? "Copied ✓" : "Copy link"}
        </button>
        <button type="button" onClick={onShare} className="btn-primary btn-sm">
          Share
        </button>
      </div>
    </div>
  );
}
