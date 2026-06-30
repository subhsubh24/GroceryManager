import { redirect } from "next/navigation";
import {
  getAdminDb,
  getDb,
  getHouseholdForUser,
  householdsEnabled,
  listHouseholdMembers,
  loadPreferenceSignals,
  withTenant,
} from "@gm/db";
import { canUse, isPremium } from "@gm/core/billing";
import { PageHeader } from "@/app/components/page-header";
import { Users } from "@/app/components/icons";
import { currentUserId } from "@/app/lib/tenant";
import { createHouseholdAction } from "./actions";
import { InviteLinkButton } from "./invite-link-button";

export const dynamic = "force-dynamic";

const header = (
  <PageHeader
    accent="brand"
    icon={Users}
    eyebrow="Shared household"
    title="Shared household"
    subtitle="Everyone in your household shares one shopping list — add an item once, it's there for all."
    topRight={<a href="/list" className="nav-link">Shopping list →</a>}
  />
);

/** Flag OFF: a tasteful placeholder. The feature is entirely dark until FEATURE_HOUSEHOLDS=1. */
function ComingSoon() {
  return (
    <main className="page">
      <PageHeader
        accent="brand"
        icon={Users}
        eyebrow="Shared household"
        title="Shared household"
        subtitle="Share one shopping list with the people you shop for."
      />
      <div className="empty-state mt-6">
        <div className="empty-emoji">
          <Users className="h-6 w-6" strokeWidth={2} />
        </div>
        <p className="text-sm font-medium text-ink-700">Shared household — coming soon</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-ink-400">
          Soon you&apos;ll be able to invite your household so everyone adds to the same list.
        </p>
      </div>
    </main>
  );
}

type Loaded =
  | { state: "signed_out" }
  | { state: "no_household" }
  | {
      state: "in_household";
      name: string;
      isOwner: boolean;
      members: { id: string; name: string | null; username: string | null; email: string | null }[];
    }
  | { state: "upgrade" }
  | { state: "error" };

async function load(): Promise<Loaded> {
  try {
    const userId = await currentUserId();
    if (!userId) return { state: "signed_out" };

    // Resolve the household + the user's entitlement signals, tenant-scoped (RLS: a member reads only
    // their own users row + household).
    const billingOn = process.env.FEATURE_BILLING === "1";
    const { household, signals } = await withTenant(getDb(), userId, async (tx) => ({
      household: await getHouseholdForUser(tx, userId),
      signals: await loadPreferenceSignals(tx, userId),
    }));

    // Household sharing is a Family-tier (premium) feature. EXISTING members keep access — they ride
    // on the owner's plan — but a non-premium user WITHOUT a household is sent to /upgrade instead of
    // the create form. This closes the paywall bypass that exists once FEATURE_HOUSEHOLDS is on
    // (creation is gated server-side in actions.ts too — never trust the client).
    if (!household && !canUse("household", isPremium(signals), billingOn)) return { state: "upgrade" };
    if (!household) return { state: "no_household" };

    // Members come from the ADMIN connection: under RLS a member can only read their OWN users row, so
    // the roster is read with the admin client, tightly scoped to this (already-resolved) household.
    const members = await listHouseholdMembers(getAdminDb(), household.id);
    return {
      state: "in_household",
      name: household.name,
      isOwner: household.ownerUserId === userId,
      members,
    };
  } catch {
    // Don't leak DB/driver error text to the client — a generic notice (matches /list).
    return { state: "error" };
  }
}

export default async function HouseholdPage() {
  if (!householdsEnabled()) return <ComingSoon />;

  const data = await load();
  if (data.state === "upgrade") redirect("/upgrade");

  return (
    <main className="page">
      {header}

      {data.state === "error" && (
        <p className="notice-warn mt-6">
          Couldn&apos;t load your household just now. Please try again.
        </p>
      )}

      {data.state === "signed_out" && (
        <p className="card-pad mt-6 text-sm text-ink-500">
          <a href="/signin" className="font-medium text-brand-700 hover:underline">Sign in</a> to create
          or join a household.
        </p>
      )}

      {data.state === "no_household" && (
        <section className="card-pad mt-6">
          <h2 className="section-title">Create a household</h2>
          <p className="mt-1 text-sm text-ink-500">
            Start a household, then invite the people you shop for.
          </p>
          <form action={createHouseholdAction} className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              name="name"
              placeholder="Household name (e.g. The Smiths)"
              className="input min-w-[16rem] flex-1"
            />
            <button type="submit" className="btn-primary shrink-0">
              Create household
            </button>
          </form>
        </section>
      )}

      {data.state === "in_household" && (
        <>
          <section className="card-pad mt-6 mb-6">
            <h2 className="section-title">{data.name}</h2>
            <p className="mt-1 text-sm text-ink-500">
              {data.members.length} member{data.members.length === 1 ? "" : "s"} · sharing one list
            </p>
            <ul className="mt-3 space-y-1 text-sm text-ink-600">
              {data.members.map((m) => {
                // Identity is username-first now (email may be null until they connect Gmail).
                const handle = m.username ?? m.email;
                return (
                  <li key={m.id}>
                    {m.name ?? handle ?? "Member"}
                    {m.name && handle ? <span className="text-ink-400"> · {handle}</span> : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card-pad">
            <h2 className="section-title">Invite a member</h2>
            <p className="mb-3 mt-1 text-sm text-ink-500">
              Share this private link — whoever opens it (and signs in) joins your household.
            </p>
            <InviteLinkButton />
          </section>
        </>
      )}
    </main>
  );
}
