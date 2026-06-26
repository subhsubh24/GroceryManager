"use client";

import { useState } from "react";

export function CheckoutButton({ plan, label }: { plan: "monthly" | "annual" | "family"; label: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Checkout unavailable — try again.");
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="btn-primary w-full"
      >
        {pending ? "Opening checkout…" : label}
      </button>
      {error && <p className="field-hint mt-2 text-danger-ink">{error}</p>}
    </div>
  );
}
