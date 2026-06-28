import { headers } from "next/headers";
import { getDb, getOrCreateReferralCode, withTenant } from "@gm/db";
import { REFERRAL_MILESTONES, referralProgress } from "@gm/core/referral/rewards";
import { currentUserId } from "@/app/lib/tenant";
import { reconcileReferralRewards } from "@/app/lib/referral";
import { PageHeader } from "@/app/components/page-header";
import { Check, Gift } from "@/app/components/icons";
import { InviteLinkButton } from "./invite-link-button";

export const dynamic = "force-dynamic";

/**
 * Resolve the signed-in user's invite code, build the absolute `${origin}/signup?ref=<code>` link from
 * the request headers (no env var, so it works across previews/prod), and reconcile their referral
 * reward standing (joined friends → earned free months, persisted idempotently). Tenant-scoped. Resilient:
 * any hiccup → no link / zeroed rewards, the page still renders its copy.
 */
async function load(): Promise<{ url: string | null; joined: number; earnedMonths: number }> {
  try {
    const userId = await currentUserId();
    if (!userId) return { url: null, joined: 0, earnedMonths: 0 };

    const code = await withTenant(getDb(), userId, (tx) => getOrCreateReferralCode(tx, userId));
    const { joined, earnedMonths } = await reconcileReferralRewards(userId);

    const h = await headers();
    const host = h.get("host");
    if (!host) return { url: null, joined, earnedMonths };
    const proto = h.get("x-forwarded-proto") ?? "https";
    return { url: `${proto}://${host}/signup?ref=${code}`, joined, earnedMonths };
  } catch {
    return { url: null, joined: 0, earnedMonths: 0 };
  }
}

export default async function InvitePage() {
  const { url, joined, earnedMonths } = await load();
  const progress = referralProgress(joined);

  return (
    <main className="page">
      <PageHeader
        accent="berry"
        icon={Gift}
        eyebrow="Invite friends"
        title="Give a month, get a month"
        subtitle="Share your link — every friend who joins earns you free months of Premium."
      />

      {/* Earned reward — the headline incentive. */}
      <section className="card-pad mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-400">Free months earned</div>
            <div className="mt-1 font-display text-3xl font-bold text-ink-900 tabular-nums">
              {earnedMonths}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-ink-400">Friends joined</div>
            <div className="mt-1 font-display text-3xl font-bold text-ink-900 tabular-nums">
              {joined}
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm text-ink-500">
          {progress.maxed
            ? "You've unlocked every referral reward — amazing. Keep sharing the love."
            : progress.friendsToNext === 1
              ? `Invite 1 more friend to reach the next reward.`
              : `Invite ${progress.friendsToNext} more friends to reach the next reward.`}
        </p>
        {earnedMonths > 0 && (
          <p className="notice-ok mt-3 flex items-center gap-1.5">
            <Check className="h-4 w-4 shrink-0" strokeWidth={2} />
            {earnedMonths === 1
              ? "1 free month is ready — it's applied automatically when you start Premium."
              : `${earnedMonths} free months are ready — applied automatically when you start Premium.`}
          </p>
        )}
      </section>

      {/* Reward ladder. */}
      <section className="card-pad mt-4">
        <h2 className="section-title">How rewards work</h2>
        <ul className="mt-3 space-y-2.5">
          {REFERRAL_MILESTONES.map((m) => {
            const reached = joined >= m.friends;
            return (
              <li key={m.reason} className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                    reached ? "bg-success text-white" : "bg-ink-100 text-ink-500"
                  }`}
                  aria-hidden
                >
                  {reached ? <Check className="h-4 w-4" strokeWidth={2.5} /> : m.friends}
                </span>
                <span className="text-sm text-ink-700">
                  <span className="font-medium text-ink-900">{m.label}</span> ·{" "}
                  {m.months === 1 ? "+1 free month" : `+${m.months} free months`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card-pad mt-4">
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
    </main>
  );
}
