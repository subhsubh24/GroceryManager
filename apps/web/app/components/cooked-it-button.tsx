"use client";
import { useState, useTransition } from "react";
import { logCookedRecipe } from "@/app/lib/cook-actions";
import { Check, Loader2, UtensilsCrossed } from "@/app/components/icons";

/**
 * One-tap "Cooked it" — logs the meal + draws down the pantry right from a recipe card (no detour).
 * Shows a clear "Logged ✓" on success. `servings` lets the cook-mode batch multiplier flow through.
 */
export function CookedItButton({
  recipeId,
  servings = 1,
  // ≥44px hit target (WCAG 2.5.5 / Apple HIG) — one-tap primary control in the core cook loop.
  // Base `.btn` sizing (px-4 py-2.5 text-sm) + min-h, NOT btn-sm (which would be a tall pill on a 12px label).
  className = "btn-primary min-h-[44px]",
}: {
  recipeId: string;
  servings?: number;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      disabled={pending || done}
      onClick={() =>
        start(async () => {
          const r = await logCookedRecipe(recipeId, servings);
          if (r.ok) setDone(true);
        })
      }
      className={className}
      aria-label={done ? "Logged" : "I cooked this"}
    >
      {done ? (
        <Check className="h-4 w-4" strokeWidth={2} />
      ) : pending ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
      ) : (
        <UtensilsCrossed className="h-4 w-4" strokeWidth={2} />
      )}
      {done ? "Logged" : "Cooked it"}
    </button>
  );
}
