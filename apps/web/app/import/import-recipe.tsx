"use client";

import { useActionState } from "react";
import { CookMode } from "../cook/[id]/cook-mode.js";
import { addNamesToListAction } from "@/app/lib/list-actions";
import { saveImportedRecipeAction } from "./actions";

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
      <form action={formAction} className="card-pad space-y-3">
        <input
          name="url"
          type="url"
          aria-label="Recipe URL"
          placeholder="Paste a recipe URL…"
          className="input mt-0"
        />
        <div className="flex items-center gap-3 text-center text-xs font-medium uppercase tracking-wide text-ink-300">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>
        <label className="block text-sm text-ink-500">
          Snap or upload a cookbook page
          <input
            name="image"
            type="file"
            accept="image/*"
            capture="environment"
            className="input-file mt-1.5"
          />
        </label>
        <div className="flex items-center gap-3 text-center text-xs font-medium uppercase tracking-wide text-ink-300">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>
        <textarea
          name="text"
          rows={5}
          aria-label="Recipe text"
          placeholder="…paste the recipe text (ingredients + steps)"
          className="input mt-0"
        />
        <button type="submit" disabled={pending} className="btn-primary btn-block">
          {pending ? "Importing…" : "Import recipe"}
        </button>
      </form>

      {state.status === "error" && <p className="notice-warn">{state.message}</p>}

      {state.status === "done" && (
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink-900">{state.title}</h2>
            <p className="mt-1 text-xs text-ink-400">
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
                className="text-xs font-semibold text-brand-700 hover:text-brand-800"
              >
                View source →
              </a>
            )}
          </div>

          <form action={saveImportedRecipeAction}>
            <input
              type="hidden"
              name="recipe"
              value={JSON.stringify({
                title: state.title,
                imageUrl: state.imageUrl,
                sourceUrl: state.sourceUrl,
                instructions: state.steps.join("\n"),
                ingredients: state.ingredients.map((i) => ({ name: i.name, measure: i.measure })),
              })}
            />
            <button type="submit" className="btn-primary">
              Save to my recipes &amp; cook →
            </button>
          </form>

          {state.missing.length > 0 && (
            <form action={addNamesToListAction} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <div className="font-semibold text-ink-900">Missing {state.missing.length}</div>
                  <div className="text-xs text-ink-400">{state.missing.join(", ")}</div>
                </div>
                {state.missing.map((m) => (
                  <input key={m} type="hidden" name="name" value={m} />
                ))}
                <button type="submit" className="btn-dark shrink-0">
                  Add missing to list →
                </button>
              </div>
            </form>
          )}

          {/* Reuse Cook Mode: pantry check on ingredients, scaling, steps with timers + wake-lock. */}
          <CookMode imageUrl={state.imageUrl} steps={state.steps} ingredients={state.ingredients} />
        </div>
      )}
    </div>
  );
}
