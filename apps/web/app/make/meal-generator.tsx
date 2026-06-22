"use client";

import { useState, useTransition } from "react";
import type { GeneratedMeal, MealEnergy } from "@gm/core/recipe/generate-llm";
import { Sparkles, ChefHat, Plus } from "@/app/components/icons";
import { addNamesToListAction } from "@/app/lib/list-actions";
import { generateMealsAction } from "./actions";

/**
 * The interactive half of /make: a "Generate ideas" button that calls the `generateMealsAction`
 * server action (the server-only LLM module is reached ONLY through that action — never imported
 * here; we import just the result TYPE). Results render as calm meal cards with collapsible steps and
 * an optional "add what's missing to my list" form. Re-generating replaces the whole list.
 */
export function MealGenerator({ energy, canGenerate }: { energy: MealEnergy; canGenerate: boolean }) {
  const [meals, setMeals] = useState<GeneratedMeal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function generate() {
    if (pending) return;
    setError(null);
    start(async () => {
      try {
        const res = await generateMealsAction(energy);
        if (res.ok) {
          setMeals(res.meals);
        } else {
          setMeals(null);
          setError(res.error);
        }
      } catch {
        setMeals(null);
        setError("Couldn't generate right now — try again.");
      }
    });
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={generate}
        disabled={!canGenerate || pending}
        className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" strokeWidth={2} />
        {pending ? "Thinking up meals…" : meals ? "Regenerate ideas" : "Generate ideas"}
      </button>

      {error && <p className="notice-warn mt-4">{error}</p>}

      {pending && (
        <p className="mt-4 text-sm text-ink-400">Inventing meals from what you have…</p>
      )}

      {meals && meals.length === 0 && !pending && (
        <div className="empty-state mt-6">
          <div className="empty-emoji">
            <ChefHat className="h-6 w-6" strokeWidth={2} />
          </div>
          <p className="text-sm font-medium text-ink-700">No ideas this time</p>
          <p className="mt-1 max-w-xs text-sm text-ink-400">
            Try a different energy level, or add a few more pantry items.
          </p>
        </div>
      )}

      {meals && meals.length > 0 && (
        <ul className="mt-6 space-y-3">
          {meals.map((meal, i) => (
            <li key={`${meal.title}-${i}`} className="card p-4">
              <div className="font-medium text-ink-900">{meal.title}</div>
              <p className="mt-0.5 text-sm text-ink-500">{meal.description}</p>

              {meal.usesFromPantry.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {meal.usesFromPantry.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center rounded-full border border-line bg-cream/60 px-2.5 py-0.5 text-xs text-ink-600"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-2 text-xs text-ink-400">
                {meal.minutes} min · {meal.effort} effort
              </div>

              {meal.steps.length > 0 && (
                <details className="group mt-3 rounded-xl border border-line bg-cream/50 px-3.5 py-2.5 transition open:bg-surface">
                  <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-ink-800 marker:content-none">
                    <span>Steps</span>
                    <span className="text-ink-300 transition group-open:rotate-180">▾</span>
                  </summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-600">
                    {meal.steps.map((step, s) => (
                      <li key={s}>{step}</li>
                    ))}
                  </ol>
                </details>
              )}

              {meal.needFromStore.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-400">
                    needs: {meal.needFromStore.join(", ")}
                  </span>
                  <form action={addNamesToListAction}>
                    {meal.needFromStore.map((name) => (
                      <input key={name} type="hidden" name="name" value={name} />
                    ))}
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-700"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Add {meal.needFromStore.length}{" "}
                      to list
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
