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

/** One experiment's status in the snapshot — maps to GROWTH_STATUS experiments[] shape. */
export interface ExperimentSummary {
  id: string;
  hypothesis: string;
  status: "running" | "decided";
  result: string | null;
  lift_pct: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
  /** ISO date the experiment started (first exposure recorded), or null when no exposures yet. */
  started: string | null;
  /** ISO date a result was decided, or null when still running. */
  decided: string | null;
}

export interface GrowthSnapshotInputs {
  /** YYYY-MM-DD stamp for this snapshot. */
  asOf: string;
  /**
   * Is the Track H growth-execution engine's CODE deployed? This is a static deployed-code
   * flag (the deployed app passes `true` because the engine code is running), NOT a per-channel
   * runtime health signal — that's what `sources` is for. A consumer wanting "is anything
   * actually connected?" reads `awaiting_connect` / `sources`, not this.
   */
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

  // --- Experiments (H10) --- optional; defaults to [] ---
  experiments?: ExperimentSummary[];
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
    /** Confirmed (double-opt-in) signups — our own datastore, always honest. */
    waitlist_confirmed: number;
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
  /**
   * Experiment results — shape matches GROWTH_STATUS experiments[] (see docs/growth/GROWTH_STATUS.md).
   * Empty array when no experiments are registered or have sufficient data.
   */
  experiments: ExperimentSummary[];
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
    experiments: input.experiments ?? [],
    funnel: {
      visitors_7d: visitors7d,
      waitlist_signups_total: waitlistTotal,
      waitlist_signups_7d: waitlistMigrated ? Math.max(0, input.waitlist7d) : 0,
      waitlist_confirmed: waitlistMigrated ? Math.max(0, input.waitlistConfirmed) : 0,
      visitor_to_waitlist_rate: visitorToWaitlist,
      trial_starts_total: 0, // not yet instrumented — honest 0, not invented
      paid_conversions_total: activeSubscribers,
      trial_to_paid_rate: null,
      active_subscribers: activeSubscribers,
      mrr_usd: mrrUsd,
      churn_rate_30d: null,
    },
    email: {
      // Size of the opted-in list available to the CONNECTED email provider. Stays 0 until a
      // provider is connected (no provider ⇒ no mailing list yet) — the raw confirmed-signup
      // count lives in funnel.waitlist_confirmed regardless. Provider open/click stats stay
      // null until the provider reports them.
      list_size: input.emailConnected ? Math.max(0, input.waitlistConfirmed) : 0,
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
  // Amortize the annual plan on the AGGREGATE, not per-subscriber: rounding 3999/12 first bakes in a
  // 0.25¢/sub downward bias (333 vs the true 333.25) that compounds and understates MRR by a whole
  // dollar at realistic counts (e.g. 56 annual subs → $186 instead of the correct $187).
  const cents =
    counts.monthly * 499 + Math.round((counts.annual * 3999) / 12) + counts.family * 999;
  return Math.round(cents / 100);
}
