"use client";

import { useState, useTransition } from "react";
import { toggleSaveAction } from "./actions";

/**
 * Heart toggle to save/unsave a recipe to "My Cookbook". Optimistic (🤍 → ❤️ immediately),
 * disabled while the server action is in flight, and reverts if the action reports failure.
 * Accessible: `aria-pressed` reflects state, `aria-label` describes the action.
 */
export function SaveButton({
  recipe,
  initialSaved,
}: {
  recipe: { id: string; title: string; imageUrl?: string; cuisine?: string };
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  function onToggle() {
    const prev = saved;
    setSaved(!prev); // optimistic
    startTransition(async () => {
      const res = await toggleSaveAction({
        id: recipe.id,
        title: recipe.title,
        imageUrl: recipe.imageUrl,
        cuisine: recipe.cuisine,
        saved: prev,
      });
      setSaved(res.saved); // authoritative; reverts on failure
    });
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from My Cookbook" : "Save to My Cookbook"}
      title={saved ? "Saved — tap to remove" : "Save to My Cookbook"}
      className="btn-ghost btn-sm shrink-0 disabled:opacity-50"
    >
      <span aria-hidden>{saved ? "❤️" : "🤍"}</span>
    </button>
  );
}
