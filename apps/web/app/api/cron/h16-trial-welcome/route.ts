import { NextResponse } from "next/server";
import { getTrialWelcomeCandidates } from "@gm/db";
import { buildTrialWelcomeEmail } from "@gm/core/lifecycle/emails";
import { isCronAuthorized, runLifecycleCampaign } from "@/app/lib/lifecycle-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * H16 / T1 — trial welcome (day 0). Schedule in vercel.json (daily), e.g. 11am:
 *   { "path": "/api/cron/h16-trial-welcome?key=<CRON_SECRET>", "schedule": "0 11 * * *" }
 * Targets users early in the 7-day trial (>3 days left). Dormant until an email provider is
 * connected (sends are dry-run-skipped + not recorded until then).
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return new NextResponse("forbidden", { status: 403 });
  const result = await runLifecycleCampaign({
    emailType: "h16_trial_welcome",
    experimentId: "h16_trial_welcome",
    getCandidates: getTrialWelcomeCandidates,
    buildEmail: buildTrialWelcomeEmail,
  });
  return NextResponse.json({ ok: true, ...result });
}
