import { headers } from "next/headers";
import { countReferralsJoined, getDb, getOrCreateReferralCode, withTenant } from "@gm/db";
import { currentUserId } from "@/app/lib/tenant";
import { PageHeader } from "@/app/components/page-header";
import { InviteLinkButton } from "./invite-link-button";

export const dynamic = "force-dynamic";

/**
 * Resolve the signed-in user's invite code + how many friends have joined, and build the absolute
 * `${origin}/signup?ref=<code>` link from the incoming request headers (no env var, so it works across
 * previews/prod). Tenant-scoped read/mint via `withTenant`. Resilient: any hiccup → no link, the page
 * still renders its copy. The route is gated by middleware, so `currentUserId()` is normally present.
 */
async function load(): Promise<{ url: string | null; joined: number }> {
  try {
    const userId = await currentUserId();
    if (!userId) return { url: null, joined: 0 };

    const { code, joined } = await withTenant(getDb(), userId, async (tx) => ({
      code: await getOrCreateReferralCode(tx, userId),
      joined: await countReferralsJoined(tx, userId),
    }));

    const h = await headers();
    const host = h.get("host");
    if (!host) return { url: null, joined };
    const proto = h.get("x-forwarded-proto") ?? "https";
    return { url: `${proto}://${host}/signup?ref=${code}`, joined };
  } catch {
    return { url: null, joined: 0 };
  }
}

export default async function InvitePage() {
  const { url, joined } = await load();

  return (
    <main className="page">
      <PageHeader
        accent="berry"
        emoji="🎁"
        eyebrow="Invite friends"
        title="Give a little, get a little"
        subtitle="Share your link — when a friend joins, you both get a Founding Friend perk."
      />

      <section className="card-pad mt-6">
        <h2 className="section-title">Your personal invite link</h2>
        <p className="mt-1 text-sm text-ink-500">
          Send it to a friend. When they sign up through it, you&apos;re both credited.
        </p>
        <div className="mt-4">
          {url ? (
            <InviteLinkButton url={url} />
          ) : (
            <p className="text-xs text-ink-400">
              Couldn&apos;t build your invite link just now — please refresh to try again.
            </p>
          )}
        </div>
      </section>

      <section className="card-pad mt-4">
        <div className="text-xs uppercase tracking-wide text-ink-400">Friends joined</div>
        <div className="mt-1 font-display text-3xl font-bold text-ink-900 tabular-nums">{joined}</div>
        <p className="mt-1 text-sm text-ink-500">
          {joined === 0
            ? "No one yet — share your link to get started."
            : joined === 1
              ? "1 friend has joined through your link. Nice!"
              : `${joined} friends have joined through your link. Nice!`}
        </p>
      </section>
    </main>
  );
}
