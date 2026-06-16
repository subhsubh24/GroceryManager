"use client";

import { useState } from "react";

/** Share this recipe page — native share sheet on mobile, clipboard copy elsewhere. */
export function ShareLinkButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // dismissed or blocked — no-op
    }
  }

  return (
    <button type="button" onClick={onShare} className="btn-primary">
      {copied ? "Link copied ✓" : "Share this recipe"}
    </button>
  );
}
