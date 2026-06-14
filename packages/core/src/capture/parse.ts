/**
 * Natural-language quick-capture parser (PLAN §10 "lowest-friction add"). Pure + tested.
 * Turns free text — "we're out of olive oil and need 2 lbs chicken, some spinach" — into a list
 * of `{ name, qtyText? }`. Deterministic + no key; an LLM parser can slot in behind the same
 * shape later for messier input.
 */

export interface ParsedCaptureItem {
  name: string;
  qtyText?: string;
}

// Longest-first so "we're out of" is stripped before "out of".
const LEAD_FILLER = [
  "we're out of",
  "we are out of",
  "i'm out of",
  "im out of",
  "running low on",
  "low on",
  "out of",
  "we also need",
  "we need",
  "i need",
  "also need",
  "need",
  "i want",
  "we want",
  "want",
  "please",
  "can you",
  "pick up",
  "pickup",
  "get me",
  "grab",
  "buy",
  "get",
  "add",
].sort((a, b) => b.length - a.length);

const ITEM_FILLER = new Set(["some", "a", "an", "the", "more", "extra", "of", "fresh"]);

const UNITS = new Set([
  "lb", "lbs", "pound", "pounds", "oz", "ounce", "ounces", "kg", "g", "gram", "grams",
  "cup", "cups", "tbsp", "tsp", "dozen", "bunch", "bunches", "can", "cans", "bottle", "bottles",
  "bag", "bags", "box", "boxes", "pack", "packs", "packet", "packets", "jar", "jars", "loaf",
  "loaves", "stick", "sticks", "head", "heads", "clove", "cloves", "liter", "liters", "l", "ml",
  "gallon", "gallons", "qt", "quart", "quarts",
]);

function stripLeadFiller(s: string): string {
  let cur = s.trim();
  for (let changed = true; changed; ) {
    changed = false;
    const lower = cur.toLowerCase();
    for (const f of LEAD_FILLER) {
      if (lower === f) return "";
      if (lower.startsWith(`${f} `)) {
        cur = cur.slice(f.length).trim();
        changed = true;
        break;
      }
    }
  }
  return cur;
}

function cleanName(s: string): string {
  let words = s
    .toLowerCase()
    .replace(/[^a-z0-9\s./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  while (words.length > 1 && ITEM_FILLER.has(words[0]!)) words = words.slice(1);
  return words.join(" ").trim();
}

function splitQty(phrase: string): { qtyText?: string; rest: string } {
  const m = phrase.match(/^(\d+(?:[.,/]\d+)?)\s+(.*)$/);
  if (!m) return { rest: phrase };
  const num = m[1]!;
  const rest = m[2]!.trim();
  const words = rest.split(/\s+/);
  if (words.length > 1 && UNITS.has(words[0]!.toLowerCase())) {
    return { qtyText: `${num} ${words[0]}`, rest: words.slice(1).join(" ") };
  }
  return { qtyText: num, rest };
}

export function parseQuickCapture(text: string | null | undefined): ParsedCaptureItem[] {
  if (!text || !text.trim()) return [];
  const phrases = text
    .replace(/\r\n?/g, "\n")
    .split(/[\n,;.]+|\band\b|\bplus\b|&/gi)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: ParsedCaptureItem[] = [];
  const seen = new Set<string>();
  for (const raw of phrases) {
    const stripped = stripLeadFiller(raw);
    if (!stripped) continue;
    const { qtyText, rest } = splitQty(stripped);
    const name = cleanName(rest);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(qtyText ? { name, qtyText } : { name });
  }
  return out;
}
