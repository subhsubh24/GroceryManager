"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "@/app/components/icons";

/**
 * A submit button that reflects the server action's in-flight state via `useFormStatus`. Rendered
 * inside a `<form action={serverAction}>`, it shows a spinner + a "doing it…" label and disables
 * itself while the action runs — so a slow Gmail sync (reading + parsing receipts) clearly looks
 * like it's working instead of a dead button. Resets on the action's redirect.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  title,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} title={title} className={className}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
