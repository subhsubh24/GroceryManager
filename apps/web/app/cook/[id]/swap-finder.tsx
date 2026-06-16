"use client";
import { useActionState } from "react";

export type SwapState =
  | { status: "idle" }
  | {
      status: "done";
      ingredient: string;
      source: "known" | "ai" | "none";
      subs: { text: string; uses?: string[] }[];
    };

export function SwapFinder({
  action,
}: {
  action: (prev: SwapState, fd: FormData) => Promise<SwapState>;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as SwapState);

  return (
    <div>
      <form action={formAction} className="flex gap-2">
        <input
          name="q"
          placeholder="Out of something? e.g. buttermilk"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink-900 shadow-xs transition placeholder:text-ink-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
        />
        <button type="submit" disabled={pending} className="btn-dark shrink-0">
          {pending ? "…" : "Find a swap"}
        </button>
      </form>

      {state.status === "done" && (
        <div className="mt-3 text-sm">
          {state.subs.length > 0 ? (
            <>
              <div className="mb-1.5 font-semibold text-ink-800">
                Swaps for {state.ingredient}
                {state.source === "ai" && <span className="ml-1 text-xs font-normal text-ink-400">· AI suggestion</span>}
              </div>
              <ul className="space-y-1.5 text-ink-600">
                {state.subs.map((s, i) => (
                  <li key={i} className="rounded-lg border border-line bg-cream/60 px-3 py-2">
                    {s.text}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-ink-400">No swap found for {state.ingredient}.</p>
          )}
        </div>
      )}
    </div>
  );
}
