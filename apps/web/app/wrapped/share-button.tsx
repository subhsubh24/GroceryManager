"use client";

import { useState } from "react";

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
    <button
      type="button"
      onClick={onShare}
      className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
    >
      {copied ? "Copied to clipboard ✓" : "Share my Wrapped"}
    </button>
  );
}
