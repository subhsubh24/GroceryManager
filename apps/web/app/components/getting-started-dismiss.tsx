"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { dismissGettingStartedAction } from "./getting-started-actions";

/**
 * Tiny dismiss control for the first-run checklist. Calls the best-effort server action to persist
 * the dismissal, then refreshes so the (server-rendered) home page re-reads the flag and drops the
 * card. Mirrors the upgrade preview-button pattern (useTransition + router.refresh).
 */
export function DismissGettingStarted() {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await dismissGettingStartedAction();
          router.refresh();
        })
      }
      aria-label="Dismiss getting started"
      title="Dismiss"
      className="btn-ghost btn-sm min-h-[44px] shrink-0 disabled:opacity-50"
    >
      {pending ? "…" : "Dismiss"}
    </button>
  );
}
