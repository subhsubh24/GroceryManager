/**
 * Eval harness (PLAN §8.5 / §12 — the "ratchet"). Deterministic scorers + aggregation for the LLM
 * tasks (receipt extraction, recipe import). The scorers here are pure and unit-tested; the live
 * eval suites (*.eval.test.ts) feed real Gemini output through them and gate on the pass rate.
 *
 * Philosophy: score the model's output against curated goldens with exact-field checks (robust,
 * cheap, deterministic). An optional LLM-as-judge (judge.ts) adds a semantic signal where exact
 * matching is too brittle. Every real-world miss should become a new golden here.
 */

export const DEFAULT_THRESHOLD = 0.8;

/** Transient API errors — rate limit (429 / RESOURCE_EXHAUSTED / quota) OR provider overload
 * (503 / UNAVAILABLE / "high demand" / overloaded / "try again later"). Infrastructure, not a quality
 * signal. The live suites skip (don't fail) on these so a transient blip ≠ a regression. */
export function isRateLimitError(e: unknown): boolean {
  const s = e instanceof Error ? e.message : String(e);
  return /\b429\b|\b503\b|RESOURCE_EXHAUSTED|UNAVAILABLE|quota|overloaded|high demand|try again later/i.test(s);
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fuzzy presence: does any actual name correspond to the expected needle (substring or all-tokens)? */
export function namePresent(actualNames: string[], needle: string): boolean {
  const n = norm(needle);
  if (!n) return false;
  const nTokens = n.split(" ").filter(Boolean);
  return actualNames.some((a) => {
    const an = norm(a);
    if (!an) return false;
    if (an.includes(n) || n.includes(an)) return true;
    const aTokens = new Set(an.split(" ").filter(Boolean));
    return nTokens.every((t) => aTokens.has(t));
  });
}

export interface EvalScore {
  score: number; // 0..1
  ok: boolean;
  detail: string[]; // human-readable notes (esp. what was missed) for the ratchet
}

export interface ExpectedReceipt {
  retailer: string;
  itemNames: string[];
  totalCents?: number;
}

/** Score a receipt extraction: item recall (0.6) + retailer (0.2) + total reconciliation (0.2). */
export function scoreReceiptExtraction(
  actual: { retailer?: string | null; totalCents?: number | null; lineItems: { name: string }[] },
  expected: ExpectedReceipt,
  threshold = DEFAULT_THRESHOLD,
): EvalScore {
  const detail: string[] = [];
  const names = actual.lineItems.map((l) => l.name);

  const missed = expected.itemNames.filter((n) => !namePresent(names, n));
  const recall = expected.itemNames.length
    ? (expected.itemNames.length - missed.length) / expected.itemNames.length
    : 1;
  if (missed.length) detail.push(`missed items: ${missed.join(", ")}`);

  const retailerOk = norm(actual.retailer ?? "") === norm(expected.retailer);
  if (!retailerOk) detail.push(`retailer: got ${actual.retailer ?? "—"}, want ${expected.retailer}`);

  let totalOk = true;
  if (expected.totalCents != null) {
    totalOk = actual.totalCents === expected.totalCents;
    if (!totalOk) detail.push(`total: got ${actual.totalCents ?? "—"}, want ${expected.totalCents}`);
  }

  const score = 0.6 * recall + 0.2 * (retailerOk ? 1 : 0) + 0.2 * (totalOk ? 1 : 0);
  return { score, ok: score >= threshold, detail };
}

export interface ExpectedRecipe {
  title: string;
  ingredientNames: string[];
  minSteps: number;
}

/** Score a recipe import: title (0.4) + ingredient recall (0.4) + enough steps (0.2). */
export function scoreRecipeImport(
  actual: { title: string; ingredients: { name: string }[]; instructions?: string | null },
  expected: ExpectedRecipe,
  threshold = DEFAULT_THRESHOLD,
): EvalScore {
  const detail: string[] = [];
  const titleOk = namePresent([actual.title], expected.title) || namePresent([expected.title], actual.title);
  if (!titleOk) detail.push(`title: got "${actual.title}", want "${expected.title}"`);

  const names = actual.ingredients.map((i) => i.name);
  const missed = expected.ingredientNames.filter((n) => !namePresent(names, n));
  const recall = expected.ingredientNames.length
    ? (expected.ingredientNames.length - missed.length) / expected.ingredientNames.length
    : 1;
  if (missed.length) detail.push(`missed ingredients: ${missed.join(", ")}`);

  const stepCount = (actual.instructions ?? "").split("\n").filter((s) => s.trim()).length;
  const stepsOk = stepCount >= expected.minSteps;
  if (!stepsOk) detail.push(`steps: got ${stepCount}, want ≥ ${expected.minSteps}`);

  const score = 0.4 * (titleOk ? 1 : 0) + 0.4 * recall + 0.2 * (stepsOk ? 1 : 0);
  return { score, ok: score >= threshold, detail };
}

export interface EvalCaseResult {
  name: string;
  score: EvalScore;
  tierUsed?: string; // which Gemini tier produced it (track escalation rate)
  attempts?: number;
}

export interface EvalReport {
  total: number;
  passed: number;
  passRate: number;
  avgScore: number;
  escalations: number; // cases that needed a tier above "cheap"
  results: EvalCaseResult[];
}

export function aggregate(results: EvalCaseResult[]): EvalReport {
  const total = results.length;
  const passed = results.filter((r) => r.score.ok).length;
  const avgScore = total ? results.reduce((s, r) => s + r.score.score, 0) / total : 1;
  const escalations = results.filter((r) => r.tierUsed && r.tierUsed !== "cheap").length;
  return { total, passed, passRate: total ? passed / total : 1, avgScore, escalations, results };
}

export function formatReport(label: string, report: EvalReport): string {
  const lines = [
    `[eval] ${label}: ${report.passed}/${report.total} passed · avg ${report.avgScore.toFixed(2)} · escalations ${report.escalations}`,
  ];
  for (const r of report.results) {
    const tier = r.tierUsed ? ` [tier=${r.tierUsed} ×${r.attempts}]` : "";
    const why = r.score.detail.length ? ` — ${r.score.detail.join("; ")}` : "";
    lines.push(`  ${r.score.ok ? "✓" : "✗"} ${r.name} (${r.score.score.toFixed(2)})${tier}${why}`);
  }
  return lines.join("\n");
}
