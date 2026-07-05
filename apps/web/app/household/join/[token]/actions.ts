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
 *
 * Deliberately NOT premium-gated: this is the Family-plan model — the OWNER pays (creating a household
 * and minting invites are premium-gated in ../../actions.ts), and invited members ride free on that
 * plan. A non-premium user can only reach here via a secret invite token minted by a paying owner, so
 * joining is not a paywall bypass. (Membership grants the shared list only; every other premium
 * feature stays independently gated by its own canUse() check.)
 */
export async function acceptInviteAction(token: string): Promise<void> {
  let ok = false;
  if (householdsEnabled() && isValidInviteToken(token)) {
    const userId = await currentUserId();
    if (userId) {
      try {
        const householdId = await acceptHouseholdInvite(getAdminDb(), userId, token);
        ok = householdId != null;
      } catch {
        // A transient DB failure must send the invitee back to the household page (as the doc
        // above promises), never bubble up as an uncaught error boundary.
        ok = false;
      }
    }
  }
  // redirect() throws to unwind — keep it OUTSIDE the guards so it isn't swallowed.
  redirect(ok ? "/list" : "/household");
}
