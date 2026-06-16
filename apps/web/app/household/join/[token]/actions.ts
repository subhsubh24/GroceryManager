"use server";

import { redirect } from "next/navigation";
import {
  acceptHouseholdInvite,
  getAdminDb,
  householdsEnabled,
  isValidInviteToken,
} from "@gm/db";
import { currentUserId } from "@/app/lib/tenant";

/**
 * Accept a household invite for the signed-in user. The token is shape-validated BEFORE any lookup,
 * then resolved + applied on the ADMIN connection (the invitee isn't a member yet, so member RLS can't
 * cover the write; the token is the only user input and flows through a parameterized `eq`). On success
 * the shared list now resolves for this user, so we send them straight to it. Flag-gated; any failure
 * sends them back to the household page rather than throwing.
 */
export async function acceptInviteAction(token: string): Promise<void> {
  let ok = false;
  if (householdsEnabled() && isValidInviteToken(token)) {
    const userId = await currentUserId();
    if (userId) {
      const householdId = await acceptHouseholdInvite(getAdminDb(), userId, token);
      ok = householdId != null;
    }
  }
  // redirect() throws to unwind — keep it OUTSIDE the guards so it isn't swallowed.
  redirect(ok ? "/list" : "/household");
}
