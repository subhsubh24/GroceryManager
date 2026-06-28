/**
 * In-memory sliding-window rate limiter (G1, G4, G7).
 *
 * Works per Node.js process. For multi-instance/serverless at scale, replace with
 * Upstash Redis — see PENDING_OPS.md. Periodic cleanup prevents unbounded growth.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (now > b.resetAt) buckets.delete(key);
  }
}, 60_000).unref();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterMs?: number;
}

// TEST/CI ONLY — disable rate limiting in an ephemeral E2E environment so the functional journey
// suite (which self-seeds many real signups from a single CI runner IP) isn't throttled by the
// signup limiter. Gated on an explicit env var that PRODUCTION NEVER SETS; unset (the default, and
// always in prod) → the limiter behaves normally. Never set RATE_LIMIT_DISABLED in production.
const RATE_LIMIT_DISABLED = process.env.RATE_LIMIT_DISABLED === "1";

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  if (RATE_LIMIT_DISABLED) return { allowed: true, limit, remaining: limit };
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, limit, remaining: limit - 1 };
  }
  if (existing.count >= limit) {
    return { allowed: false, limit, remaining: 0, retryAfterMs: existing.resetAt - now };
  }
  existing.count++;
  return { allowed: true, limit, remaining: limit - existing.count };
}

export function tooManyRequests(retryAfterMs?: number): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (retryAfterMs !== undefined) {
    headers["Retry-After"] = String(Math.ceil(retryAfterMs / 1000));
  }
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down and try again." }),
    { status: 429, headers },
  );
}
