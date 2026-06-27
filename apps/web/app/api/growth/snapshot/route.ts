import { timingSafeEqual } from "crypto";
import {
  getAdminDb,
  getWaitlistSubmissions,
  getWaitlistConfirmedCount,
  getActiveSubscriberStats,
} from "@gm/db";
import { buildGrowthSnapshot, computeMrrUsd } from "@gm/core/growth/snapshot";
import { auth } from "@/auth";
import { serverError } from "../../_lib/guard";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * H7 — Analytics PULL read-API (machine-readable, agent-callable).
 *
 * GET /api/growth/snapshot
 *
 * Aggregates REAL funnel/conversion numbers from the connected sources (the in-app waitlist
 * datastore, Stripe billing, Plausible analytics, the email provider) into the GROWTH_STATUS
 * shape, so the separate Growth Agent can populate docs/growth/GROWTH_STATUS.md with real
 * signal instead of all-null. Per-source, a metric stays 0/null and the source is marked
 * `awaiting_connect` until that source's credentials are present in the deployed app's env.
 *
 * Auth (either): an admin session (user email === ADMIN_EMAIL), OR a CRON_SECRET bearer token
 * (so the Growth Agent's deployment can pull it headlessly). The agent NEVER holds these keys —
 * only the deployed app does.
 */
export async function GET(req: Request) {
  // --- Rate limit (Track G) — low-volume admin/cron endpoint ---
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  const rl = rateLimit(`growth-snapshot:${ip}`, 30, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  // --- AuthZ: admin session OR CRON_SECRET bearer ---
  const cronSecret = process.env["CRON_SECRET"];
  const authHeader = req.headers.get("authorization");
  let authorized = false;

  if (cronSecret && authHeader) {
    const expected = `Bearer ${cronSecret}`;
    const ab = Buffer.from(authHeader, "utf8");
    const bb = Buffer.from(expected, "utf8");
    authorized = ab.length === bb.length && timingSafeEqual(ab, bb);
  }
  if (!authorized) {
    const session = await auth();
    const userEmail = (session?.user as { email?: string } | undefined)?.email;
    const adminEmail = process.env["ADMIN_EMAIL"];
    authorized = !!userEmail && !!adminEmail && userEmail === adminEmail;
  }
  if (!authorized) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const db = getAdminDb();

    // --- Waitlist (in-app datastore — always available once migrated) ---
    const wl = await getWaitlistSubmissions(db);
    const waitlistConfirmed = await getWaitlistConfirmedCount(db);

    // --- Billing (Stripe) — only pull subscriber numbers when connected ---
    const stripeConnected = !!process.env["STRIPE_SECRET_KEY"];
    let activeSubscribers = 0;
    let mrrUsd = 0;
    if (stripeConnected) {
      const subs = await getActiveSubscriberStats(db);
      activeSubscribers = subs.active;
      mrrUsd = computeMrrUsd({ monthly: subs.monthly, annual: subs.annual, family: subs.family });
    }

    // --- Web analytics (Plausible) — best-effort real pull when connected ---
    const plausibleDomain = process.env["NEXT_PUBLIC_PLAUSIBLE_DOMAIN"];
    const plausibleKey = process.env["PLAUSIBLE_API_KEY"];
    let plausibleConnected = false;
    let visitors7d = 0;
    if (plausibleDomain && plausibleKey) {
      const v = await fetchPlausibleVisitors7d(plausibleDomain, plausibleKey);
      if (v !== null) {
        plausibleConnected = true;
        visitors7d = v;
      }
    }

    // --- Email provider connected? (any supported key present) ---
    const emailConnected =
      !!process.env["RESEND_API_KEY"] ||
      !!process.env["SENDGRID_API_KEY"] ||
      !!process.env["POSTMARK_API_KEY"];

    const asOf = new Date().toISOString().slice(0, 10);
    const snapshot = buildGrowthSnapshot({
      asOf,
      engineBuilt: true, // the Track H growth-execution engine is live in code
      waitlistTotal: wl ? wl.total : null,
      waitlist7d: wl ? wl.lastSevenDays : 0,
      waitlistConfirmed,
      plausibleConnected,
      visitors7d,
      stripeConnected,
      activeSubscribers,
      mrrUsd,
      emailConnected,
    });

    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return serverError("growth/snapshot", err);
  }
}

/**
 * Pull last-7-days unique visitors from the Plausible Stats API (Aggregate endpoint).
 * Returns null on any error / non-OK response so the caller treats analytics as not-connected
 * rather than reporting a fabricated number. Self-hosted instances can override the base URL
 * via PLAUSIBLE_API_URL.
 */
async function fetchPlausibleVisitors7d(domain: string, apiKey: string): Promise<number | null> {
  const base = (process.env["PLAUSIBLE_API_URL"] ?? "https://plausible.io").replace(/\/$/, "");
  const url = `${base}/api/v1/stats/aggregate?site_id=${encodeURIComponent(domain)}&period=7d&metrics=visitors`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      // Never let a slow analytics provider hang the snapshot.
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: { visitors?: { value?: number } } };
    const value = data?.results?.visitors?.value;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
