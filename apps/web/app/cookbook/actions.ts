"use server";

import { getDb, saveRecipe, unsaveRecipe, withTenant } from "@gm/db";
import { currentUserId } from "@/app/lib/tenant";

/**
 * Toggle a recipe in the user's cookbook. `saved` is the *current* state from the client, so we
 * unsave when already saved and save otherwise. Resilient: never throws to the client — on any
 * failure it returns the unchanged state so the optimistic button reverts.
 */
export async function toggleSaveAction(input: {
  id: string;
  title: string;
  imageUrl?: string;
  cuisine?: string;
  saved: boolean;
}): Promise<{ saved: boolean }> {
  try {
    if (!input.id || !input.title) return { saved: input.saved };
    const userId = await currentUserId();
    if (!userId) return { saved: input.saved };

    await withTenant(getDb(), userId, (tx) =>
      input.saved
        ? unsaveRecipe(tx, userId, input.id)
        : saveRecipe(tx, userId, {
            id: input.id,
            title: input.title,
            imageUrl: input.imageUrl,
            cuisine: input.cuisine,
          }),
    );
    return { saved: !input.saved };
  } catch {
    // DB/auth hiccup — report the prior state so the client reverts its optimistic toggle.
    return { saved: input.saved };
  }
}
