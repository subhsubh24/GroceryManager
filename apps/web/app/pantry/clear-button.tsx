"use client";

import { useTransition } from "react";
import { clearPantryAction } from "./actions";

/**
 * "Clear pantry & start fresh" — a destructive reset behind a confirm. Wipes the pantry projection,
 * its ledger, and the receipt history so re-importing receipts or re-scanning rebuilds it cleanly
 * (no dedup blocking the re-import). Client-only so it can confirm before firing the server action.
 */
export function ClearPantryButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          window.confirm(
            "Clear your entire pantry and start fresh? This removes all items + receipt history and can't be undone.",
          )
        ) {
          start(() => void clearPantryAction());
        }
      }}
      className="text-xs font-medium text-ink-400 transition-colors hover:text-danger disabled:opacity-50"
    >
      {pending ? "Clearing…" : "Clear pantry & start fresh"}
    </button>
  );
}
