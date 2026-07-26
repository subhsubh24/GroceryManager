"use client";

import { useState, useTransition } from "react";
import { Check } from "@/app/components/icons";
import { getCookbookShareLinkAction } from "./actions";

/**
 * "Share my cookbook" — mints (once) and reveals the public, unguessable link to the user's saved-recipe
 * collection. On reveal it tries the native share sheet (`navigator.share`); the link is always shown
 * with a Copy button as the fallback. Resilient: a null result (signed-out / DB hiccup) shows a gentle
 * inline message rather than throwing. Mirrors share/recipe/[id]/share-button.tsx.
 */
export function ShareCookbookButton() {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function onShare() {
    setFailed(false);
    startTransition(async () => {
      const res = await getCookbookShareLinkAction();
      if (!res.url) {
        setFailed(true);
        return;
      }
      setUrl(res.url);
      // Offer the native share sheet on first reveal; ignore dismissal/blocking.
      try {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ title: "My GroceryManager cookbook", url: res.url });
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
        <button type="button" onClick={onShare} disabled={pending} className="btn-primary disabled:opacity-50">
          {pending ? "Creating link…" : "Share my cookbook"}
        </button>
        {failed && (
          <p className="text-xs text-ink-400">Couldn&apos;t create a share link just now — please try again.</p>
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
        aria-label="Public link to your cookbook"
        className="input flex-1 text-xs"
      />
      <button
        type="button"
        onClick={onCopy}
        className="btn-secondary btn-sm inline-flex min-h-[44px] shrink-0 items-center gap-1.5"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" strokeWidth={2} /> Copied
          </>
        ) : (
          "Copy link"
        )}
      </button>
    </div>
  );
}
