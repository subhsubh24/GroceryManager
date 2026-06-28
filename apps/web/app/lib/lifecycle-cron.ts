/**
 * Shared orchestration for the lifecycle email campaigns (H14 annual-nudge, H15 win-back).
 *
 * The two cron routes are thin wrappers around `runLifecycleCampaign` so the CRON_SECRET auth,
 * variant assignment, dry-run-honest send accounting, and idempotent recording live in ONE place.
 *
 * SIDE-EFFECT INTEGRITY: a recipient is recorded in `lifecycle_email_sends` (and counted as `sent`)
 * ONLY when the provider returned sent=true. With no provider connected the send is `skipped` and
 * NOT recorded, so the campaign retries once the owner connects a provider — no fake success.
 *
 * Do NOT import drizzle-orm here; only @gm/db and @gm/core (the apps/web dependency rule).
 */
import { timingSafeEqual } from "crypto";
import { loadEnv } from "@gm/config/env";
import {
  getAdminDb,
  getDb,
  withTenant,
  logExposure,
  recordLifecycleEmailSent,
  type LifecycleCandidate,
  type Querier,
} from "@gm/db";
import { assignVariant, getExperiment } from "@gm/core/growth/experiments";
import { generateUnsubscribeToken, sendEmail, type EmailPayload } from "@gm/core/email";
import type { BuiltEmail, LifecycleEmailInput } from "@gm/core/lifecycle/emails";

/** Base URL for building absolute links in emails when APP_URL is unset (links only, never auth). */
const FALLBACK_APP_URL = "https://grocerymanager.app";

/**
 * CRON_SECRET gate — identical to the digest cron: a `?key=` query param OR a `Bearer` header, both
 * compared in constant time. When CRON_SECRET is unset, allow only outside production (dev/staging).
 */
export function isCronAuthorized(req: Request): boolean {
  const env = loadEnv();
  if (!env.CRON_SECRET) return process.env.NODE_ENV !== "production";
  const key = new URL(req.url).searchParams.get("key");
  const auth = req.headers.get("authorization");
  const eq = (a: string | null, b: string) => {
    if (!a) return false;
    const ab = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  };
  return eq(key, env.CRON_SECRET) || eq(auth, `Bearer ${env.CRON_SECRET}`);
}

/**
 * Experiment bucketing secret — keyed off a per-deploy secret (never a hardcoded literal). Mirrors
 * the apps/web experiments helper chain so variant assignment is consistent across surfaces.
 */
function getExperimentSecret(): string {
  return (
    process.env["EXPERIMENT_SECRET"] ??
    process.env["WAITLIST_OPTIN_SECRET"] ??
    process.env["EMAIL_UNSUBSCRIBE_SECRET"] ??
    process.env["AUTH_SECRET"] ??
    process.env["NEXTAUTH_SECRET"] ??
    ""
  );
}

export interface CampaignResult {
  campaign: string;
  eligible: number;
  /** Provider returned sent=true (and the user was recorded). */
  sent: number;
  /** No provider connected — dry-run; NOT recorded, will retry once connected. */
  skipped: number;
  /** Provider returned a real failure — NOT recorded, will retry next run. */
  failed: number;
}

/**
 * Run one lifecycle campaign: fetch eligible recipients (admin/RLS-bypassing read), assign each a
 * stable variant, build + send their email, and record only true sends. Per-user errors are isolated
 * so one bad row never aborts the batch.
 */
export async function runLifecycleCampaign(opts: {
  emailType: string;
  experimentId: string;
  getCandidates: (db: Querier) => Promise<LifecycleCandidate[]>;
  buildEmail: (input: LifecycleEmailInput) => BuiltEmail;
}): Promise<CampaignResult> {
  const env = loadEnv();
  const appUrl = (env.APP_URL ?? FALLBACK_APP_URL).replace(/\/$/, "");
  const secret = getExperimentSecret();
  const variants = getExperiment(opts.experimentId)?.variants ?? ["control"];
  const admin = getAdminDb();

  const candidates = await opts.getCandidates(admin);
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of candidates) {
    try {
      let variant = variants[0];
      try {
        variant = assignVariant(c.userId, opts.experimentId, variants, secret);
      } catch {
        // bucketing failure → control; never block the send
      }

      const unsubscribeUrl = `${appUrl}/api/email/unsubscribe?email=${encodeURIComponent(
        c.email,
      )}&token=${generateUnsubscribeToken(c.email)}`;
      const built = opts.buildEmail({ name: c.name, appUrl, unsubscribeUrl, variant });
      const payload: EmailPayload = {
        to: c.email,
        subject: built.subject,
        html: built.html,
        text: built.text,
        listUnsubscribeUrl: unsubscribeUrl,
      };

      const result = await sendEmail(payload);
      if (result.sent) {
        sent++;
        // Idempotent record — only after the email truly left (side-effect integrity).
        try {
          await recordLifecycleEmailSent(admin, {
            userId: c.userId,
            emailType: opts.emailType,
            variant,
          });
        } catch (e) {
          console.error(`[lifecycle/${opts.emailType}] record failed for ${c.userId}`, e);
        }
        // Best-effort experiment exposure (per-tenant) — never blocks.
        try {
          await withTenant(getDb(), c.userId, (tx) =>
            logExposure(tx, c.userId, opts.experimentId, variant),
          );
        } catch {
          // swallowed — exposure logging is best-effort
        }
      } else if (result.skipped) {
        skipped++; // dry-run: no provider — do NOT record, retry once connected
      } else {
        failed++; // real provider failure — do NOT record, retry next run
      }
    } catch (e) {
      failed++;
      console.error(`[lifecycle/${opts.emailType}] user ${c.userId} failed`, e);
    }
  }

  return { campaign: opts.emailType, eligible: candidates.length, sent, skipped, failed };
}
