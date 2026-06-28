"use client";

import { useState } from "react";
import { Check } from "@/app/components/icons";
import { submitWaitlistEmail, type WaitlistResult } from "./waitlist-action";
import { trackConversion } from "./experiment-action";
import { trackEvent } from "@/app/lib/plausible";

/**
 * Staged email capture for the landing page waitlist. SIDE-EFFECT INTEGRITY (FACTORY_STANDARD §6):
 * the success state is contingent on the REAL result — we show "you're on the list" only when the
 * email was actually captured, and "check your email" only when a confirmation email truly left. A
 * failed capture shows an honest error, never a fake success.
 */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<WaitlistResult | null>(null);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    let result: WaitlistResult;
    try {
      result = await submitWaitlistEmail(email);
    } catch {
      result = "error";
    }

    if (result === "error") {
      // The email was NOT captured — never show a fake "you're on the list".
      setError("Something went wrong — please try again in a moment.");
      return;
    }
    // Only track a conversion on a real capture.
    trackEvent("waitlist_signup");
    void trackConversion("landing_hero", "waitlist_signup");
    setDone(result);
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
        <Check className="h-5 w-5 shrink-0 text-brand-600" strokeWidth={2.5} />
        {done === "confirm_sent"
          ? "Almost there — check your email to confirm your spot."
          : "You’re on the list — we’ll reach out when the app launches."}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        className="input input-lg"
        autoComplete="email"
        required
      />
      <button type="submit" className="btn-primary px-5 py-3 text-base">
        Notify me
      </button>
      {error && <p className="text-xs text-danger-ink sm:col-span-2">{error}</p>}
    </form>
  );
}
