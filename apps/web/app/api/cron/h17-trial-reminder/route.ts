import { NextResponse } from "next/server";
import { getTrialReminderCandidates } from "@gm/db";
import { buildTrialReminderEmail } from "@gm/core/lifecycle/emails";
import { isCronAuthorized, runLifecycleCampaign } from "@/app/lib/lifecycle-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * H17 / T2 — trial reminder (~2 days left). Schedule in vercel.json (daily), e.g. 12pm:
 *   { "path": "/api/cron/h17-trial-reminder?key=<CRON_SECRET>", "schedule": "0 12 * * *" }
 * Targets trials with 1–3 days left; transparent about the auto-convert. Dormant until an email
 * provider is connected (sends are dry-run-skipped + not recorded until then).
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return new NextResponse("forbidden", { status: 403 });
  const result = await runLifecycleCampaign({
    emailType: "h17_trial_reminder",
    experimentId: "h17_trial_reminder",
    getCandidates: getTrialReminderCandidates,
    buildEmail: buildTrialReminderEmail,
  });
  return NextResponse.json({ ok: true, ...result });
}
