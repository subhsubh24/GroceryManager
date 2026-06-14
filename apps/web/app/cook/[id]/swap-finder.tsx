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
          className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "…" : "Find a swap"}
        </button>
      </form>

      {state.status === "done" && (
        <div className="mt-3 text-sm">
          {state.subs.length > 0 ? (
            <>
              <div className="mb-1 font-medium text-ink">
                Swaps for {state.ingredient}
                {state.source === "ai" && <span className="ml-1 text-xs text-ink/40">· AI suggestion</span>}
              </div>
              <ul className="space-y-1 text-ink/70">
                {state.subs.map((s, i) => (
                  <li key={i} className="rounded-lg bg-zinc-50 px-3 py-2">
                    {s.text}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-ink/50">No swap found for {state.ingredient}.</p>
          )}
        </div>
      )}
    </div>
  );
}
