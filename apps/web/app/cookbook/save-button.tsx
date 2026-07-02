"use client";

import { useState, useTransition } from "react";
import { Heart } from "@/app/components/icons";
import { toggleSaveAction } from "./actions";

/**
 * Heart toggle to save/unsave a recipe to "My Cookbook". Optimistic (outline → filled heart
 * immediately), disabled while the server action is in flight, and reverts if the action reports
 * failure. Accessible: `aria-pressed` reflects state, `aria-label` describes the action.
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
      className="-my-2 -mr-2 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-ink-50 disabled:opacity-50"
    >
      <Heart
        aria-hidden
        className={`h-4 w-4 ${saved ? "text-danger" : "text-ink-400"}`}
        strokeWidth={2}
        fill={saved ? "currentColor" : "none"}
      />
    </button>
  );
}
