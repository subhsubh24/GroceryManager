"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantPremiumPreviewAction } from "./actions";

/**
 * Preview-only control standing in for a real Stripe checkout. Grants the premium entitlement so the
 * gated experience can be exercised before billing is wired. Refreshes so the page reflects the grant.
 */
export function PreviewButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await grantPremiumPreviewAction();
            setMsg(r.ok ? "Premium granted (preview)." : "Couldn't grant — try again.");
            if (r.ok) router.refresh();
          })
        }
        className="btn-ghost btn-sm"
      >
        {pending ? "…" : "Grant Premium (preview)"}
      </button>
      {msg && <span className="text-xs text-ink-500">{msg}</span>}
    </div>
  );
}
