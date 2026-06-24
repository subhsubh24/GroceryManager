"use client";

import { useState } from "react";
import { Check } from "@/app/components/icons";

/**
 * Staged email capture for the landing page waitlist. Emails are collected client-side for now;
 * see PENDING_OPS.md to wire up to ConvertKit / Mailchimp before launch.
 */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
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
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        className="input input-lg flex-1"
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
