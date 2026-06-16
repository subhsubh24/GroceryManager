"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { grantPremiumPreviewAction } from "./actions";

/**
 * Preview-only control: flips the signed-in user to premium (writes the entitlement signal) so the
 * gate can be exercised WITHOUT a payment flow. This is a stand-in for the real Stripe webhook and is
 * intentionally low-key in the UI. Hidden once the user is already premium.
 */
export function GrantPremiumPreview({ premium }: { premium: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (premium) return null;

  function grant() {
    setMsg(null);
    startTransition(async () => {
      const res = await grantPremiumPreviewAction();
      if (res.ok) {
        // Re-render the server component so `premium` flips to true (badge shows, this control hides).
        router.refresh();
      } else {
        setMsg("Couldn't grant preview access just now.");
      }
    });
  }

  return (
    <section className="mt-8 rounded-2xl border border-dashed border-black/10 bg-white/60 p-5 text-center">
      <p className="text-xs uppercase tracking-wide text-ink/40">Preview / testing</p>
      <p className="mt-1 text-sm text-ink/60">
        No Stripe yet. Grant yourself premium to try the entitlement gate.
      </p>
      <button
        type="button"
        onClick={grant}
        disabled={pending}
        className="mt-3 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-ink/70 transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "…" : "Grant premium (preview)"}
      </button>
      {msg && <p className="mt-3 text-sm text-ink/70">{msg}</p>}
    </section>
  );
}
