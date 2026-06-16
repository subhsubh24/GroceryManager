"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  createHousehold,
  createHouseholdInvite,
  getDb,
  getHouseholdForUser,
  householdsEnabled,
  withTenant,
} from "@gm/db";
import { currentUserId } from "@/app/lib/tenant";

/**
 * Create the signed-in user's household (they become owner + first member). Flag-gated and
 * tenant-scoped (`withTenant`) so the writes pass RLS. No-op when the flag is off or signed out.
 * Idempotent: if they already belong to a household, it doesn't create a second one.
 */
export async function createHouseholdAction(formData: FormData): Promise<void> {
  if (!householdsEnabled()) return;
  const userId = await currentUserId();
  if (!userId) return;
  const name = String(formData.get("name") ?? "").trim() || undefined;
  await withTenant(getDb(), userId, async (tx) => {
    const existing = await getHouseholdForUser(tx, userId);
    if (existing) return;
    await createHousehold(tx, userId, name);
  });
  revalidatePath("/household");
}

/**
 * Mint an invite to the user's household and return the absolute join URL
 * `${proto}://${host}/household/join/<token>`. Origin comes from the request headers (no env), so it
 * works across previews/prod. Tenant-scoped so the invite INSERT passes RLS. Resilient: any failure /
 * flag-off / not-in-a-household → `{ url: null }`.
 */
export async function createInviteLinkAction(): Promise<{ url: string | null }> {
  try {
    if (!householdsEnabled()) return { url: null };
    const userId = await currentUserId();
    if (!userId) return { url: null };

    const token = await withTenant(getDb(), userId, async (tx) => {
      const household = await getHouseholdForUser(tx, userId);
      if (!household) return null;
      return createHouseholdInvite(tx, userId, household.id);
    });
    if (!token) return { url: null };

    const h = await headers();
    const host = h.get("host");
    if (!host) return { url: null };
    const proto = h.get("x-forwarded-proto") ?? "https";
    return { url: `${proto}://${host}/household/join/${token}` };
  } catch {
    return { url: null };
  }
}
