/**
 * Gemini vision detection for pantry/fridge scans (PLAN §5.6). Isolated from reconcile.ts so the
 * reconciliation heart stays pure + offline-testable; this is the thin model-facing adapter.
 *
 * Cheap-first: Flash-Lite handles routine shelves (the harness re-grounds reliability), escalating
 * only on a failed structured parse. Presence is reported per item so reconcile can treat presence
 * as strong and absence as weak (§5.6). The label is normalized to a canonical item downstream via
 * the §5.4 cascade — here we only see + describe.
 */
import { z } from "zod";
import type { GeminiTier } from "@gm/config/constants";
import { getGeminiClient, type GeminiClient, type ImagePart } from "../llm/client.js";

export type ScanLocation = "fridge" | "pantry" | "freezer" | "other";

export interface VisionDetection {
  label: string;
  qtyEstimate: number | null;
  unitGuess: string | null;
  presenceConfidence: number; // 0..1
  qtyConfidence: number | null;
}

const VisionDetectionSchema = z.object({
  detections: z.array(
    z.object({
      label: z.string(),
      qtyEstimate: z.number().nullable(),
      unitGuess: z.string().nullable(),
      presenceConfidence: z.number(),
      qtyConfidence: z.number().nullable(),
    }),
  ),
});

export interface DetectOpts {
  client?: GeminiClient;
  tier?: GeminiTier;
  location?: ScanLocation;
}

function systemPrompt(location: ScanLocation): string {
  return [
    `You are looking at one or more photos of a ${location}.`,
    "List every distinct food or grocery item you can CLEARLY see.",
    "Use a short, generic label (e.g. 'milk', 'baby spinach', 'ketchup') — not brand slogans.",
    "Estimate a quantity + unit only when obvious; otherwise leave them null.",
    "presenceConfidence is how sure you are the item is really there (0..1).",
    "Do NOT guess at items hidden behind others or inside opaque containers.",
    "Return JSON only.",
  ].join(" ");
}

/** Detect grocery items in one or more photos. Returns a flat, de-duplicated-by-caller list. */
export async function detectPantryItems(
  images: ImagePart[],
  opts: DetectOpts = {},
): Promise<VisionDetection[]> {
  if (images.length === 0) return [];
  const client = opts.client ?? getGeminiClient();
  const location = opts.location ?? "fridge";

  const res = await client.generateStructured(
    VisionDetectionSchema,
    "Identify the grocery items visible in the attached photo(s).",
    { tier: opts.tier ?? "cheap", system: systemPrompt(location), images },
  );
  return res.detections;
}
