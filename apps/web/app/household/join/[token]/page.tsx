import {
  getAdminDb,
  getHouseholdInviteByToken,
  getUserHouseholdId,
  householdsEnabled,
  isValidInviteToken,
} from "@gm/db";
import { PageHeader } from "@/app/components/page-header";
import { Check, Link2, Repeat, Users } from "@/app/components/icons";
import { currentUserId } from "@/app/lib/tenant";
import { acceptInviteAction } from "./actions";

export const dynamic = "force-dynamic";

function Invalid() {
  return (
    <main className="page">
      <PageHeader
        accent="brand"
        icon={Link2}
        eyebrow="Household invite"
        title="Invite not found"
        subtitle="This invite link is invalid, expired, or already used. Ask for a fresh link."
        back={null}
      />
      <div className="mt-6">
        <a href="/household" className="nav-link">Go to your household →</a>
      </div>
    </main>
  );
}

export default async function JoinHouseholdPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Feature dark → don't reveal anything about invites.
  if (!householdsEnabled()) return <Invalid />;
  // Cheap shape gate BEFORE any DB work — rejects junk / injection-flavored input.
  if (!isValidInviteToken(token)) return <Invalid />;

  // Resolve the invite on the admin connection (the visitor may not be a member yet). The token is the
  // only user input and flows through a parameterized eq inside getHouseholdInviteByToken.
  const admin = getAdminDb();
  const invite = await getHouseholdInviteByToken(admin, token);
  if (!invite) return <Invalid />;
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return <Invalid />;
  const householdName = invite.householdName;

  // Middleware gates this route, so a signed-out visitor is bounced to /signin?callbackUrl=… first;
  // by the time the page renders the user is authenticated. Keep a defensive branch regardless.
  const userId = await currentUserId();
  if (userId) {
    const myHouseholdId = await getUserHouseholdId(admin, userId);
    // Already a member of THIS household — nothing to do.
    if (myHouseholdId === invite.householdId) {
      return (
        <main className="page">
          <PageHeader
            accent="brand"
            icon={Check}
            eyebrow="Household invite"
            title={`You're already in ${householdName}`}
            back={null}
          />
          <div className="mt-6">
            <a href="/list" className="nav-link">Go to the shared list →</a>
          </div>
        </main>
      );
    }
    // In a DIFFERENT household — joining would move them; surface it plainly instead of silently moving.
    if (myHouseholdId && myHouseholdId !== invite.householdId) {
      return (
        <main className="page">
          <PageHeader
            accent="brand"
            icon={Repeat}
            eyebrow="Household invite"
            title="You're already in another household"
            subtitle={`Leave your current household first to join ${householdName}.`}
            back={null}
          />
          <div className="mt-6">
            <a href="/household" className="nav-link">Go to your household →</a>
          </div>
        </main>
      );
    }
  }

  // The accept action is bound to this token; it re-validates the flag, session, and token server-side.
  const accept = acceptInviteAction.bind(null, token);

  return (
    <main className="page">
      <PageHeader
        accent="brand"
        icon={Users}
        eyebrow="Household invite"
        title={`Join ${householdName}`}
        subtitle="Accept to share one shopping list with everyone in this household."
        back={null}
      />
      {!userId ? (
        <a
          href={`/signin?callbackUrl=${encodeURIComponent(`/household/join/${token}`)}`}
          className="btn-primary mt-6 inline-flex"
        >
          Sign in to join
        </a>
      ) : (
        <form action={accept} className="mt-6">
          <button type="submit" className="btn-primary">
            Accept invite
          </button>
        </form>
      )}
    </main>
  );
}
