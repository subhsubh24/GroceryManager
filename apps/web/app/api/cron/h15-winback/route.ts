import { NextResponse } from "next/server";
import { getWinbackCandidates } from "@gm/db";
import { buildWinbackEmail } from "@gm/core/lifecycle/emails";
import { isCronAuthorized, runLifecycleCampaign } from "@/app/lib/lifecycle-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * H15 — win-back / churn-prevention. Schedule in vercel.json (weekly), e.g. Tuesdays 10am:
 *   { "path": "/api/cron/h15-winback?key=<CRON_SECRET>", "schedule": "0 10 * * 2" }
 * Targets churned-but-still-active free users 30+ days after cancellation. Dormant until an email
 * provider is connected (sends are dry-run-skipped + not recorded until then).
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return new NextResponse("forbidden", { status: 403 });
  const result = await runLifecycleCampaign({
    emailType: "h15_winback",
    experimentId: "h15_winback",
    getCandidates: getWinbackCandidates,
    buildEmail: buildWinbackEmail,
  });
  return NextResponse.json({ ok: true, ...result });
}
