/**
 * Cooking streak + weekly cook stats — a sticky habit-reinforcement surface (PLAN §10 growth).
 * Pure + tested, computed entirely from the user's own `mealLogs.cookedAt` timestamps.
 *
 * All bucketing is UTC-day based and multiple cooks on the same calendar day collapse to ONE
 * (a streak is "did you cook that day", not "how many times"). `cooksThisWeek` is the one stat
 * that counts raw cooks, since "meals cooked this week" is a volume, not a streak.
 *
 * Weeks start Monday (UTC) to match common habit-tracker conventions.
 */

const DAY_MS = 86_400_000;

/** Midnight-UTC epoch-day index for a Date (floor to the day, ignoring time-of-day). */
function utcDayIndex(d: Date): number {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY_MS);
}

/** Distinct set of UTC day-indices on which at least one cook happened. */
function cookDaySet(cookedAt: Date[]): Set<number> {
  const days = new Set<number>();
  for (const d of cookedAt) days.add(utcDayIndex(d));
  return days;
}

/** Midnight UTC (ms) of the Monday that starts the week containing `d`. */
function weekStartMs(d: Date): number {
  const dayStart = utcDayIndex(d) * DAY_MS;
  // getUTCDay: 0=Sun..6=Sat → days since Monday (Mon=0 … Sun=6).
  const dow = new Date(dayStart).getUTCDay();
  const sinceMonday = (dow + 6) % 7;
  return dayStart - sinceMonday * DAY_MS;
}

/** ISO date (YYYY-MM-DD) for a midnight-UTC epoch-ms value. */
function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Consecutive days (ending today, or yesterday if nothing is logged today yet) on which the user
 * cooked at least once. Returns 0 when there's no cook today or yesterday. Same-day dupes count once.
 */
export function currentStreak(cookedAt: Date[], now: Date): number {
  if (cookedAt.length === 0) return 0;
  const days = cookDaySet(cookedAt);
  const today = utcDayIndex(now);

  // Anchor on today if cooked today, else yesterday (grace: today may not be over yet).
  let cursor: number;
  if (days.has(today)) cursor = today;
  else if (days.has(today - 1)) cursor = today - 1;
  else return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor--;
  }
  return streak;
}

/** The longest run of consecutive cooked days anywhere in the history. 0 when none. */
export function longestStreak(cookedAt: Date[]): number {
  if (cookedAt.length === 0) return 0;
  const days = [...cookDaySet(cookedAt)].sort((a, b) => a - b);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] === days[i - 1]! + 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  return longest;
}

/** Count of cooks (raw, not deduped) in the current Monday-start week (UTC). */
export function cooksThisWeek(cookedAt: Date[], now: Date): number {
  const start = weekStartMs(now);
  const end = start + 7 * DAY_MS;
  let count = 0;
  for (const d of cookedAt) {
    const t = d.getTime();
    if (t >= start && t < end) count++;
  }
  return count;
}

/**
 * Per-week cook counts for the last `weeks` weeks, oldest → newest, for a mini bar chart.
 * Each `weekStart` is the ISO date of that week's Monday (UTC); `count` is raw cooks in the week.
 * Always returns exactly `weeks` buckets (zero-filled), so the chart has a stable width.
 */
export function weeklyActivity(
  cookedAt: Date[],
  now: Date,
  weeks = 8,
): { weekStart: string; count: number }[] {
  const thisWeekStart = weekStartMs(now);
  const buckets: { weekStart: string; count: number }[] = [];
  // Build oldest → newest so the chart reads left (past) to right (now).
  for (let i = weeks - 1; i >= 0; i--) {
    buckets.push({ weekStart: isoDate(thisWeekStart - i * 7 * DAY_MS), count: 0 });
  }
  const indexByStart = new Map(buckets.map((b, i) => [b.weekStart, i]));

  for (const d of cookedAt) {
    const key = isoDate(weekStartMs(d));
    const idx = indexByStart.get(key);
    if (idx !== undefined) buckets[idx]!.count++;
  }
  return buckets;
}
