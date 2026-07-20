"use client";

import { useState, useEffect } from "react";
import { Mail, Star, X } from "@/app/components/icons";

const DISMISS_KEY = "gm_dismiss_gmail_teaser";

/**
 * Dismissible premium-upsell banner for Gmail receipt import.
 *
 * Shown only when:
 *   - The user is NOT premium (`isPremium === false`, computed server-side).
 *   - Gmail is NOT already connected (`gmailConnected === false`, computed server-side).
 *   - The user has NOT previously dismissed this banner (localStorage key absent).
 *
 * Persists dismissal in localStorage so it never re-shows after the user taps X.
 * The `hidden` class prevents a flash of the banner on mount before localStorage is read.
 */
export function GmailUpgradeBanner({
  isPremium,
  gmailConnected,
}: {
  isPremium: boolean;
  gmailConnected: boolean;
}) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  // Read localStorage after mount (SSR-safe — localStorage is unavailable on the server).
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (isPremium || gmailConnected) return null;
  // While we haven't read localStorage yet, render nothing to avoid flash.
  if (dismissed === null) return null;
  if (dismissed) return null;

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage blocked (private mode, storage full) — dismiss in-memory only.
    }
    setDismissed(true);
  }

  return (
    <div
      role="region"
      aria-label="Premium feature: Gmail receipt import"
      className="animate-fade-in-up mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {/* Icon tile — brand accent, Mail icon (already in registry). */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-white text-brand-700">
            <Mail className="h-5 w-5" strokeWidth={2} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink-900">
                Auto-fill your pantry from receipts
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                <Star className="h-3 w-3" strokeWidth={2} aria-hidden />
                Premium
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Connect Gmail once and your Amazon, Whole Foods, and Instacart receipt
              emails automatically update your pantry.
            </p>
            {/* ≥44px hit target (WCAG 2.5.5 / Apple HIG) — Premium conversion CTA; base .btn sizing + min-h. */}
            <a
              href="/upgrade?feature=gmail_import"
              className="btn-primary mt-3 inline-flex min-h-[44px]"
            >
              See Premium
            </a>
          </div>
        </div>

        {/* Dismiss control — accessible, quiet, no tooltip needed. */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss Gmail import promotion"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-brand-100 hover:text-ink-600"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
