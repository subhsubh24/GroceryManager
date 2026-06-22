"use client";

import { useState } from "react";
import { Check } from "@/app/components/icons";

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
    <button type="button" onClick={onShare} className="btn-primary inline-flex items-center gap-1.5">
      {copied ? (
        <>
          <Check className="h-4 w-4" strokeWidth={2} /> Link copied
        </>
      ) : (
        "Share this recipe"
      )}
    </button>
  );
}
