"use server";

import { headers } from "next/headers";
import { getDb, getOrCreateCookbookShareToken, saveRecipe, unsaveRecipe, withTenant } from "@gm/db";
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

/**
 * Get (minting on first use) the absolute, public, unguessable link to *this* user's cookbook:
 * `${proto}://${host}/share/cookbook/<token>`. Tenant-scoped (`withTenant`) so the token write passes
 * RLS. The origin comes from the incoming request's `host` + `x-forwarded-proto` (defaulting to https),
 * not an env var, so it works across previews/prod without config. Resilient: any failure → `{url:null}`.
 */
export async function getCookbookShareLinkAction(): Promise<{ url: string | null }> {
  try {
    const userId = await currentUserId();
    if (!userId) return { url: null };

    const token = await withTenant(getDb(), userId, (tx) => getOrCreateCookbookShareToken(tx, userId));

    const h = await headers();
    const host = h.get("host");
    if (!host) return { url: null };
    const proto = h.get("x-forwarded-proto") ?? "https";
    return { url: `${proto}://${host}/share/cookbook/${token}` };
  } catch {
    return { url: null };
  }
}
