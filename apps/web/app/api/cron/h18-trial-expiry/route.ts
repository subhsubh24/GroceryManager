import { NextResponse } from "next/server";
import { getTrialExpiryCandidates } from "@gm/db";
import { buildTrialExpiryEmail } from "@gm/core/lifecycle/emails";
import { isCronAuthorized, runLifecycleCampaign } from "@/app/lib/lifecycle-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * H18 / T3 — trial expiry (ends today). Schedule in vercel.json (daily), e.g. 8am:
 *   { "path": "/api/cron/h18-trial-expiry?key=<CRON_SECRET>", "schedule": "0 8 * * *" }
 * Targets trials ending within the next day; anti-surprise-charge transparency + annual upsell.
 * Dormant until an email provider is connected (sends are dry-run-skipped + not recorded until then).
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return new NextResponse("forbidden", { status: 403 });
  const result = await runLifecycleCampaign({
    emailType: "h18_trial_expiry",
    experimentId: "h18_trial_expiry",
    getCandidates: getTrialExpiryCandidates,
    buildEmail: buildTrialExpiryEmail,
  });
  return NextResponse.json({ ok: true, ...result });
}
