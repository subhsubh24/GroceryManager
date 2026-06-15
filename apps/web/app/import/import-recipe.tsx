"use client";

import { useActionState } from "react";
import { CookMode } from "../cook/[id]/cook-mode.js";
import { addNamesToListAction } from "@/app/lib/list-actions";

export type ImportIngredient = { name: string; measure?: string; inPantry: boolean };

export type ImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "done";
      method: "page data" | "AI";
      title: string;
      imageUrl?: string;
      servings?: string | null;
      sourceUrl?: string;
      steps: string[];
      ingredients: ImportIngredient[];
      missing: string[];
      haveCount: number;
      totalCount: number;
    };

export function ImportRecipe({
  action,
}: {
  action: (prev: ImportState, fd: FormData) => Promise<ImportState>;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as ImportState);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-3 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <input
          name="url"
          type="url"
          placeholder="Paste a recipe URL…"
          className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm"
        />
        <div className="text-center text-xs text-ink/40">— or —</div>
        <textarea
          name="text"
          rows={5}
          placeholder="…paste the recipe text (ingredients + steps)"
          className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Importing…" : "Import recipe"}
        </button>
      </form>

      {state.status === "error" && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{state.message}</p>
      )}

      {state.status === "done" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-ink">{state.title}</h2>
            <p className="mt-0.5 text-xs text-ink/50">
              Imported via {state.method}
              {state.servings ? ` · ${state.servings}` : ""}
              {state.totalCount > 0
                ? ` · you have ${state.haveCount}/${state.totalCount} ingredients`
                : ""}
            </p>
            {state.sourceUrl && (
              <a
                href={state.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-brand-600"
              >
                View source →
              </a>
            )}
          </div>

          {state.missing.length > 0 && (
            <form
              action={addNamesToListAction}
              className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <div className="font-medium text-ink">Missing {state.missing.length}</div>
                  <div className="text-xs text-ink/50">{state.missing.join(", ")}</div>
                </div>
                {state.missing.map((m) => (
                  <input key={m} type="hidden" name="name" value={m} />
                ))}
                <button
                  type="submit"
                  className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Add missing to list →
                </button>
              </div>
            </form>
          )}

          {/* Reuse Cook Mode: pantry ✓ on ingredients, ×scaling, steps with timers + wake-lock. */}
          <CookMode imageUrl={state.imageUrl} steps={state.steps} ingredients={state.ingredients} />
        </div>
      )}
    </div>
  );
}
