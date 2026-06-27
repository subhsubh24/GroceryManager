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
