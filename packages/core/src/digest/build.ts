/**
 * Weekly digest / "Sunday briefing" (PLAN §10 proactive digest). Pure + tested: composes the
 * cross-cutting summary from the engines already built (expiring, reorder-due, spend, cooked).
 * Push *delivery* is a follow-up; this is the content the page renders and a notification would carry.
 */

export interface DigestExpiring {
  name: string;
  reason: string;
  daysLeft: number | null;
}
export interface DigestReorder {
  name: string;
  recommendQty: number | null;
  recommendByDate: Date | null;
}

export interface DigestInput {
  expiring: DigestExpiring[];
  reorderDue: DigestReorder[];
  spentThisWeekCents: number;
  homeCookedThisWeek: number;
}

export interface DigestSummary {
  headline: string;
  subline: string;
  expiringCount: number;
  reorderCount: number;
  spentThisWeekCents: number;
  homeCookedThisWeek: number;
  topExpiring: DigestExpiring[];
  topReorder: DigestReorder[];
  isQuiet: boolean;
}

const TOP = 5;
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const fmtUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function buildDigest(input: DigestInput): DigestSummary {
  const expiringCount = input.expiring.length;
  const reorderCount = input.reorderDue.length;
  const isQuiet = expiringCount === 0 && reorderCount === 0;

  const parts: string[] = [];
  if (reorderCount > 0) parts.push(`${reorderCount} to reorder`);
  if (expiringCount > 0) parts.push(`${expiringCount} expiring soon`);
  const headline = isQuiet
    ? "All quiet — nothing's running low or about to spoil."
    : `${cap(parts.join(" · "))}.`;

  const cooked =
    input.homeCookedThisWeek > 0
      ? `You cooked ${input.homeCookedThisWeek} meal${input.homeCookedThisWeek === 1 ? "" : "s"} this week`
      : "No meals logged this week yet";
  const subline = `${cooked} · ${fmtUsd(input.spentThisWeekCents)} spent.`;

  return {
    headline,
    subline,
    expiringCount,
    reorderCount,
    spentThisWeekCents: input.spentThisWeekCents,
    homeCookedThisWeek: input.homeCookedThisWeek,
    topExpiring: input.expiring.slice(0, TOP),
    topReorder: input.reorderDue.slice(0, TOP),
    isQuiet,
  };
}
