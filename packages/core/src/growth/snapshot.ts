/**
 * H7 — Growth analytics PULL snapshot (pure builder).
 *
 * Assembles the machine-readable `GROWTH_STATUS` shape (see docs/growth/GROWTH_STATUS.md)
 * from REAL inputs collected by the deployed app. This is the logic the separate Growth
 * Agent consumes (via `GET /api/growth/snapshot`) so it can populate GROWTH_STATUS with
 * real signal instead of all-null.
 *
 * HONESTY BAR (VISION): every value is real or `null`/`0` — NEVER invented. Per-source, a
 * metric stays `0`/`null` and the source is marked `awaiting_connect` until that source's
 * credentials are present (and the deployed app — never the agent — holds those keys).
 *
 * Pure + client-safe: no env, no I/O. The route does the data-fetching + env reads and
 * passes the results in here.
 */

export type GrowthPhase = "pre_launch" | "launching" | "post_launch";
export type SourceStatus = "connected" | "awaiting_connect";

export interface GrowthSnapshotInputs {
  /** YYYY-MM-DD stamp for this snapshot. */
  asOf: string;
  /** Is the Track H growth-execution engine live in code? (true once H1–H8 ship.) */
  engineBuilt: boolean;

  // --- Waitlist (the in-app datastore — always "connected" once migrated) ---
  /** Total waitlist signups, or null if the table doesn't exist yet (pre-migration). */
  waitlistTotal: number | null;
  /** Waitlist signups in the last 7 days (0 when waitlistTotal is null). */
  waitlist7d: number;
  /** Confirmed (double-opt-in) waitlist signups (0 when unknown). */
  waitlistConfirmed: number;

  // --- Web analytics (Plausible) ---
  plausibleConnected: boolean;
  /** Visitors in the last 7 days from the analytics source (0/unknown until connected). */
  visitors7d: number;

  // --- Billing (Stripe) ---
  stripeConnected: boolean;
  /** Distinct users whose latest entitlement signal is premium. */
  activeSubscribers: number;
  /** Monthly recurring revenue in whole USD, derived from active tier mix. */
  mrrUsd: number;

  // --- Email provider (Resend/Sendgrid/Postmark) ---
  emailConnected: boolean;
}

export interface GrowthSnapshot {
  project: "GroceryManager";
  as_of: string;
  phase: GrowthPhase;
  engine_built: boolean;
  channels_connected: string[];
  awaiting_connect: boolean;
  /** Per-source connection status so `engine_built` stays honest (not all-null faking). */
  sources: {
    waitlist: SourceStatus;
    analytics: SourceStatus;
    billing: SourceStatus;
    email: SourceStatus;
  };
  funnel: {
    visitors_7d: number;
    waitlist_signups_total: number;
    waitlist_signups_7d: number;
    visitor_to_waitlist_rate: number | null;
    trial_starts_total: number;
    paid_conversions_total: number;
    trial_to_paid_rate: number | null;
    active_subscribers: number;
    mrr_usd: number;
    churn_rate_30d: number | null;
  };
  email: {
    list_size: number;
    double_opt_in: true;
    last_stage_sent: string | null;
    open_rate: number | null;
    click_rate: number | null;
  };
  links: {
    in_app_analytics: string;
    owner_doc: string;
  };
}

/** Round to a fixed number of decimals, returning null for non-finite inputs. */
function round(n: number, dp = 4): number | null {
  if (!Number.isFinite(n)) return null;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Build the GROWTH_STATUS snapshot from real, already-fetched inputs.
 * The deployed app collects the inputs; this function only shapes + derives.
 */
export function buildGrowthSnapshot(input: GrowthSnapshotInputs): GrowthSnapshot {
  const waitlistMigrated = input.waitlistTotal !== null;
  const waitlistTotal = input.waitlistTotal ?? 0;

  const sources = {
    // The waitlist datastore is the app's own DB — "connected" once the table exists.
    waitlist: waitlistMigrated ? "connected" : ("awaiting_connect" as SourceStatus),
    analytics: input.plausibleConnected ? "connected" : ("awaiting_connect" as SourceStatus),
    billing: input.stripeConnected ? "connected" : ("awaiting_connect" as SourceStatus),
    email: input.emailConnected ? "connected" : ("awaiting_connect" as SourceStatus),
  } as const;

  const channels_connected: string[] = [];
  if (sources.analytics === "connected") channels_connected.push("analytics");
  if (sources.billing === "connected") channels_connected.push("billing");
  if (sources.email === "connected") channels_connected.push("email");

  // Only EXTERNAL channels count toward "awaiting_connect" — the in-app waitlist DB does not.
  const awaiting_connect = channels_connected.length === 0;

  // Phase is derived from REAL state, never asserted optimistically.
  let phase: GrowthPhase = "pre_launch";
  if (input.stripeConnected && input.activeSubscribers > 0) phase = "post_launch";
  else if (input.stripeConnected) phase = "launching";

  const visitors7d = input.plausibleConnected ? Math.max(0, input.visitors7d) : 0;
  const visitorToWaitlist =
    input.plausibleConnected && visitors7d > 0 ? round(input.waitlist7d / visitors7d) : null;

  const activeSubscribers = input.stripeConnected ? Math.max(0, input.activeSubscribers) : 0;
  const mrrUsd = input.stripeConnected ? Math.max(0, input.mrrUsd) : 0;

  return {
    project: "GroceryManager",
    as_of: input.asOf,
    phase,
    engine_built: input.engineBuilt,
    channels_connected,
    awaiting_connect,
    sources,
    funnel: {
      visitors_7d: visitors7d,
      waitlist_signups_total: waitlistTotal,
      waitlist_signups_7d: waitlistMigrated ? Math.max(0, input.waitlist7d) : 0,
      visitor_to_waitlist_rate: visitorToWaitlist,
      trial_starts_total: 0, // not yet instrumented — honest 0, not invented
      paid_conversions_total: activeSubscribers,
      trial_to_paid_rate: null,
      active_subscribers: activeSubscribers,
      mrr_usd: mrrUsd,
      churn_rate_30d: null,
    },
    email: {
      // Confirmed double-opt-in list size from our own datastore (real); provider stats
      // (open/click) stay null until the email provider is connected.
      list_size: Math.max(0, input.waitlistConfirmed),
      double_opt_in: true,
      last_stage_sent: null,
      open_rate: null,
      click_rate: null,
    },
    links: {
      in_app_analytics: "/admin/waitlist",
      owner_doc: "docs/growth/GROWTH_STATUS.md",
    },
  };
}

/**
 * MRR (whole USD) from active-tier counts, using the canonical plan prices.
 * monthly $4.99 · annual $39.99/yr → $3.3325/mo · family $9.99/mo.
 */
export function computeMrrUsd(counts: {
  monthly: number;
  annual: number;
  family: number;
}): number {
  const cents = counts.monthly * 499 + counts.annual * Math.round(3999 / 12) + counts.family * 999;
  return Math.round(cents / 100);
}
