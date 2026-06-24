"use client";

import { useState } from "react";
import { Check } from "@/app/components/icons";
import { submitWaitlistEmail } from "./waitlist-action";

/**
 * Staged email capture for the landing page waitlist. Emails are sent server-side (logged to
 * stdout); see PENDING_OPS.md to wire up to ConvertKit / Mailchimp before launch.
 */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    await submitWaitlistEmail(email);
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
        <Check className="h-5 w-5 shrink-0 text-brand-600" strokeWidth={2.5} />
        You&apos;re on the list — we&apos;ll reach out when the app launches.
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
