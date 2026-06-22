"use client";

import { useState } from "react";
import { Check } from "@/app/components/icons";

/**
 * The one client component on /wrapped (the page stays a server component). Uses the Web Share
 * sheet where available (mobile PWA), falling back to clipboard copy on desktop browsers.
 */
export function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const shareData = { title: "My Grocery Wrapped", text };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user dismissed the share sheet, or clipboard denied — no-op
    }
  }

  return (
    <button type="button" onClick={onShare} className="btn-primary inline-flex items-center gap-1.5">
      {copied ? (
        <>
          <Check className="h-4 w-4" strokeWidth={2} /> Copied to clipboard
        </>
      ) : (
        "Share my Wrapped"
      )}
    </button>
  );
}
