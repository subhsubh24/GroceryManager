"use server";

import { redirect } from "next/navigation";
import { getDb, withTenant } from "@gm/db";
import { captureToList } from "@gm/core/capture";
import { currentUserId } from "@/app/lib/tenant";

/**
 * Add one or more named items (recipe gaps) to the active shopping list, then show the cart.
 * Reads repeated `name` fields from the form; reuses captureToList (trigram-match-or-create + RLS).
 * Tagged `recipe_need` so the list shows *why* each item is there. redirect() runs after the work.
 */
export async function addNamesToListAction(formData: FormData) {
  const names = formData
    .getAll("name")
    .map(String)
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length === 0) return;

  const userId = await currentUserId();
  if (userId) {
    await withTenant(getDb(), userId, (tx) =>
      captureToList(
        tx,
        userId,
        names.map((name) => ({ name })),
        { reason: "recipe_need" },
      ),
    );
  }
  redirect("/list");
}
