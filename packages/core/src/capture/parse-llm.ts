/**
 * LLM-assisted quick-capture (PLAN §10 "lowest-friction add"). The deterministic `parseQuickCapture`
 * handles tidy notes; this validates + structures MESSY free input — fixes misspellings, drops
 * brands/filler, splits run-ons, and pulls out quantities — returning the SAME `{ name, qtyText? }`
 * shape so it's a drop-in. Server-only (reaches Gemini): import ONLY from a server action, never a
 * client component. Best-effort by contract — the caller falls back to `parseQuickCapture` on any
 * failure or when no key is configured.
 */
import { z } from "zod";
import type { GeminiClient } from "../llm/client.js";
import type { ParsedCaptureItem } from "./parse.js";

const CaptureSchema = z.object({
  items: z.array(z.object({ name: z.string(), qtyText: z.string().nullable() })),
});

const SYSTEM =
  "You turn a messy grocery note into a clean shopping list. Fix obvious misspellings " +
  "(avacado→avocado, choclate→chocolate, brocoli→broccoli). Use a short GENERIC item name — drop " +
  "brands, adjectives, and filler words like 'some' or 'a couple'. Split multiple items into separate " +
  "entries and de-duplicate. Pull out a quantity ONLY when the user stated one (e.g. '2 lbs', " +
  "'1 dozen', '3'); otherwise leave qtyText null. Never invent items. Return JSON only.";

/**
 * Parse + validate a free-text capture via the cheap tier. Throws on model/parse failure (the caller
 * catches and falls back). Names are lowercased + trimmed; blanks dropped; capped to a sane length.
 */
export async function parseCaptureWithLLM(
  client: GeminiClient,
  text: string,
): Promise<ParsedCaptureItem[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const res = await client.generateStructured(CaptureSchema, `Note:\n${trimmed.slice(0, 1000)}`, {
    tier: "cheap",
    system: SYSTEM,
  });
  const seen = new Set<string>();
  const out: ParsedCaptureItem[] = [];
  for (const i of res.items) {
    const name = (i.name ?? "").trim().toLowerCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const qtyText = i.qtyText?.trim();
    out.push(qtyText ? { name, qtyText } : { name });
    if (out.length >= 50) break;
  }
  return out;
}
