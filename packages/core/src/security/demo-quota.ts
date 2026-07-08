/**
 * Spend ceiling for the PUBLIC, no-account "try the aha" demo (ROADMAP §34, G7).
 *
 * The demo runs a real (paid) Gemini extraction with NO logged-in user to key a per-user quota on, so
 * it is the one AI surface an anonymous stranger can reach. That makes a hard, code-level ceiling the
 * load-bearing wallet-drain protection — a per-IP rate limit alone is not enough because IPs rotate
 * cheaply. We enforce TWO daily ceilings, both resetting at UTC midnight:
 *
 *   - per-IP daily  — stops one visitor from monopolising the demo budget (default 5/day).
 *   - GLOBAL daily  — a single absolute cap on demo extractions across ALL callers, so even an
 *                     IP-rotating botnet cannot push spend past a known, bounded ceiling
 *                     (default 500/day). THIS is the true spend bound.
 *
 * Pure + in-memory (per Node process), with a dependency-injected clock so the reset + ceiling logic
 * is unit-tested keyless. Mirrors `llm-quota.ts` (per-user) and `rate-limit.ts` (per-IP window); like
 * them, back it with Redis for cross-instance accuracy at scale (see PENDING_OPS.md). Per-instance
 * counting only ever UNDER-counts against a shared budget, so it never fails open past the ceiling on
 * a single instance — the guarantee we care about for abuse.
 */

export interface DemoQuotaLimits {
  /** Max demo extractions per client IP per UTC day. */
  perIpDaily: number;
  /** Absolute max demo extractions across ALL callers per UTC day — the wallet-drain ceiling. */
  globalDaily: number;
}

/** Read the ceilings from the environment with safe, conservative defaults (never unbounded). */
export function demoQuotaLimits(env: NodeJS.ProcessEnv = process.env): DemoQuotaLimits {
  const perIpDaily = clampPositive(env.DEMO_PARSE_LIMIT_PER_IP, 5);
  const globalDaily = clampPositive(env.DEMO_PARSE_LIMIT_GLOBAL, 500);
  return { perIpDaily, globalDaily };
}

function clampPositive(raw: string | undefined, fallback: number): number {
  const n = raw === undefined ? NaN : parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type DemoQuotaReason = "ok" | "ip" | "global";

export interface DemoQuotaResult {
  /** True only when BOTH ceilings still have headroom AND this call was counted. */
  allowed: boolean;
  /** Why it was denied ("ip" or "global"), or "ok" when allowed. */
  reason: DemoQuotaReason;
}

interface DayCounter {
  count: number;
  day: string; // YYYY-MM-DD UTC
}

const perIp = new Map<string, DayCounter>();
const global: DayCounter = { count: 0, day: "" };

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export interface CheckDemoQuotaOptions {
  now?: number;
  limits?: DemoQuotaLimits;
}

/**
 * Reserve one demo extraction for `ip`. Returns `{ allowed: true }` and increments BOTH counters only
 * when neither ceiling is exceeded; otherwise denies WITHOUT incrementing (a denied call must not
 * consume budget). Check this BEFORE spending on the LLM call.
 */
export function checkDemoQuota(ip: string, opts: CheckDemoQuotaOptions = {}): DemoQuotaResult {
  const now = opts.now ?? Date.now();
  const limits = opts.limits ?? demoQuotaLimits();
  const day = utcDay(now);

  // Roll the global counter over at the UTC day boundary.
  if (global.day !== day) {
    global.day = day;
    global.count = 0;
  }

  const ipEntry = perIp.get(ip);
  const ipCount = ipEntry && ipEntry.day === day ? ipEntry.count : 0;

  // Enforce per-IP first (a friendlier, more specific signal to the caller), then the global ceiling.
  if (ipCount >= limits.perIpDaily) return { allowed: false, reason: "ip" };
  if (global.count >= limits.globalDaily) return { allowed: false, reason: "global" };

  perIp.set(ip, { count: ipCount + 1, day });
  global.count += 1;
  return { allowed: true, reason: "ok" };
}

/** Test-only: reset all in-memory counters so cases don't leak state into one another. */
export function __resetDemoQuota(): void {
  perIp.clear();
  global.count = 0;
  global.day = "";
}
