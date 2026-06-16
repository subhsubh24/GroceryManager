"use client";

import { useState } from "react";

/**
 * Keyless ordering path: copy the list to the clipboard so it can be pasted into Instacart (or any
 * grocery app / notes). The page stays a server component; this is the only client bit. One-tap IDP
 * prefill replaces this once an Instacart API key is configured (see /api/instacart).
 */
export function CopyListButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers without the async clipboard API (or denied permission).
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // Give up silently — the list is still on screen to copy by hand.
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" onClick={onCopy} className="btn-primary">
      {copied ? "Copied ✓" : "Copy list"}
    </button>
  );
}
