import { NextResponse } from "next/server";
import { getAnnualNudgeCandidates } from "@gm/db";
import { buildAnnualNudgeEmail } from "@gm/core/lifecycle/emails";
import { isCronAuthorized, runLifecycleCampaign } from "@/app/lib/lifecycle-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * H14 — month-3 annual-conversion nudge. Schedule in vercel.json (weekly), e.g. Mondays 9am:
 *   { "path": "/api/cron/h14-annual-nudge?key=<CRON_SECRET>", "schedule": "0 9 * * 1" }
 * Dormant until an email provider is connected (sends are dry-run-skipped + not recorded until then).
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return new NextResponse("forbidden", { status: 403 });
  const result = await runLifecycleCampaign({
    emailType: "h14_annual_nudge",
    experimentId: "h14_annual_nudge",
    getCandidates: getAnnualNudgeCandidates,
    buildEmail: buildAnnualNudgeEmail,
  });
  return NextResponse.json({ ok: true, ...result });
}
