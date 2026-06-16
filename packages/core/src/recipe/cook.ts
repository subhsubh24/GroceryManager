/**
 * Cook Mode helpers (PLAN §10 "Hands-free Cook Mode"). Pure + testable; no key.
 *
 *   splitSteps          — an instruction blob → clean, numbered steps
 *   extractTimerMinutes — find a duration in a step ("simmer 10 minutes" → 10)
 *   scaleMeasure        — batch-scale a measure string ("1 1/2 cups" ×2 → "3 cups")
 *
 * Deliberately heuristic: TheMealDB instructions are free text and measures are unstructured,
 * so these degrade gracefully (pass non-numeric text through, return null when no timer is found).
 */

const UNICODE_FRAC: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
};

/** A single quantity token: "1 1/2", "1½", "1/2", "1.5", "200", "½" (most-specific first). */
const NUM = "(?:\\d+\\s+\\d/\\d|\\d+\\s*[½¼¾⅓⅔]|\\d/\\d|\\d+(?:[.,]\\d+)?|[½¼¾⅓⅔])";

function parseQtyToken(raw: string): number | null {
  const tok = raw.trim();
  const mixed = tok.match(/^(\d+)\s+(\d)\/(\d)$/); // "1 1/2"
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = tok.match(/^(\d)\/(\d)$/); // "1/2"
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const uni = tok.match(/^(\d+)\s*([½¼¾⅓⅔])$/); // "1½"
  if (uni) return Number(uni[1]) + (UNICODE_FRAC[uni[2]!] ?? 0);
  if (UNICODE_FRAC[tok] != null) return UNICODE_FRAC[tok]; // "½"
  const n = Number(tok.replace(",", ".")); // "1.5" / "200"
  return Number.isFinite(n) ? n : null;
}

/** Render a scaled quantity back to a friendly string (common fractions, else 2dp). */
function formatQty(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  const whole = Math.floor(rounded);
  const frac = rounded - whole;
  const common: [number, string][] = [
    [0.25, "¼"],
    [1 / 3, "⅓"],
    [0.5, "½"],
    [2 / 3, "⅔"],
    [0.75, "¾"],
  ];
  for (const [v, g] of common) {
    if (Math.abs(frac - v) < 0.02) return whole ? `${whole}${g}` : g;
  }
  return String(rounded);
}

function stripStepLabel(s: string): string {
  return s
    .replace(/^step\s*\d+\s*[:.)\-]?\s*/i, "") // "STEP 1:", "Step 2 "
    .replace(/^\d+\s*[.):\-]\s+/, ""); // "1.", "2)", "3 -"
}

export function splitSteps(instructions: string | null | undefined): string[] {
  const text = (instructions ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return [];

  // Prefer explicit line breaks; fall back to sentence boundaries for one-blob instructions.
  let parts = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) {
    parts = text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return parts.map(stripStepLabel).map((s) => s.trim()).filter((s) => s.length > 1);
}

const DURATION_RE = new RegExp(`(${NUM})\\s*(hours?|hrs?|h|minutes?|mins?|min|m)\\b`, "gi");

/** Minutes of the longest duration mentioned in a step (the one worth a timer), else null. */
export function extractTimerMinutes(step: string): number | null {
  let best: number | null = null;
  for (const m of step.matchAll(DURATION_RE)) {
    const qty = parseQtyToken(m[1]!);
    if (qty == null) continue;
    const isHours = /^h/i.test(m[2]!);
    const minutes = Math.round(qty * (isHours ? 60 : 1));
    if (minutes > 0 && (best == null || minutes > best)) best = minutes;
  }
  return best;
}

const MEASURE_RE = new RegExp(`^(${NUM})(\\s*(?:-|–|to)\\s*(${NUM}))?(.*)$`, "i");

/** Batch-scale the leading quantity of a measure by an integer factor; non-numeric passes through. */
export function scaleMeasure(measure: string, factor: number): string {
  const text = (measure ?? "").trim();
  if (!text || !Number.isFinite(factor) || factor === 1) return text;

  const m = text.match(MEASURE_RE);
  if (!m) return text; // e.g. "to taste"
  const a = parseQtyToken(m[1]!);
  if (a == null) return text;

  const lo = formatQty(a * factor);
  const rest = m[4] ?? "";
  if (m[3] != null) {
    const b = parseQtyToken(m[3]);
    if (b != null) {
      const sep = m[2]!.toLowerCase().includes("to") ? " to " : "-";
      return `${lo}${sep}${formatQty(b * factor)}${rest}`;
    }
  }
  return `${lo}${rest}`;
}
