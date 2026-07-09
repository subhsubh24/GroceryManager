/**
 * Per-user daily LLM call quota (G7 — API spend ceiling).
 *
 * Resets at UTC midnight. In-memory per-instance; for persistent cross-instance state,
 * back with Redis — see PENDING_OPS.md. Defaults: 10 free / 100 premium calls per day.
 * Override via LLM_DAILY_LIMIT_FREE / LLM_DAILY_LIMIT_PREMIUM env vars.
 */

interface QuotaEntry {
  count: number;
  date: string; // YYYY-MM-DD UTC
}

const quotas = new Map<string, QuotaEntry>();

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface QuotaResult {
  allowed: boolean;
  count: number;
  limit: number;
}

export function checkLlmQuota(userId: string, isPremiumUser: boolean): QuotaResult {
  const freeLimit = parseInt(process.env.LLM_DAILY_LIMIT_FREE ?? "10", 10);
  const premiumLimit = parseInt(process.env.LLM_DAILY_LIMIT_PREMIUM ?? "100", 10);
  const limit = isPremiumUser ? premiumLimit : freeLimit;
  const today = todayUtc();
  const entry = quotas.get(userId);
  if (!entry || entry.date !== today) {
    quotas.set(userId, { count: 1, date: today });
    return { allowed: true, count: 1, limit };
  }
  if (entry.count >= limit) {
    return { allowed: false, count: entry.count, limit };
  }
  entry.count++;
  return { allowed: true, count: entry.count, limit };
}

/**
 * Settle EXTRA calls a single request actually made beyond the 1 already charged by `checkLlmQuota`.
 * The "ask your kitchen" agent runs a function-calling loop that can fan out to several Gemini calls
 * per ask; charging a flat 1 at the gate under-counts the G7 spend ceiling by up to that multiplier.
 * The caller pre-charges 1 at the gate, then records `actualCalls - 1` here once the loop reports its
 * real step count — so a user who runs deep multi-step asks hits the ceiling proportionally sooner.
 * No allow/deny decision (the budget was already consumed); just accrue. No-op for <= 0.
 */
export function recordLlmUsage(userId: string, additionalCalls: number): void {
  if (!Number.isFinite(additionalCalls) || additionalCalls <= 0) return;
  const today = todayUtc();
  const entry = quotas.get(userId);
  if (!entry || entry.date !== today) {
    // Day rolled over (or no prior entry) between the gate check and settlement — start fresh.
    quotas.set(userId, { count: Math.floor(additionalCalls), date: today });
    return;
  }
  entry.count += Math.floor(additionalCalls);
}
