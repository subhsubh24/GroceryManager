"use client";

import { useEffect, useState } from "react";
import { Check } from "@/app/components/icons";

/**
 * Get the list off the screen and onto your phone: on devices with the Web Share API (iPhone/Android)
 * this opens the share sheet — tap Messages to text it to yourself, or send it anywhere. Falls back to
 * copy-to-clipboard on desktop. (One-tap Instacart prefill replaces this once a key is configured.)
 */
export function CopyListButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  // Detect share support after mount (navigator isn't available during SSR → avoids a hydration gap).
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  async function copyToClipboard() {
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

  async function onClick() {
    if (canShare) {
      try {
        await navigator.share({ title: "My grocery list", text });
      } catch {
        // User cancelled the share sheet — do nothing (don't surprise them with a copy).
      }
      return;
    }
    await copyToClipboard();
  }

  return (
    <button type="button" onClick={onClick} className="btn-primary inline-flex items-center gap-1.5">
      {copied ? (
        <>
          <Check className="h-4 w-4" strokeWidth={2} /> Copied
        </>
      ) : canShare ? (
        "Send list to phone"
      ) : (
        "Copy list"
      )}
    </button>
  );
}
