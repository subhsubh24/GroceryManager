/**
 * Gemini vision detection for pantry/fridge scans (PLAN §5.6). Isolated from reconcile.ts so the
 * reconciliation heart stays pure + offline-testable; this is the thin model-facing adapter.
 *
 * Accuracy-first (a scan is infrequent + user-initiated, so it's worth a stronger tier): defaults to
 * Flash at `mediaResolution: high` — the zoomed reframing resolves small / partially-occluded items
 * on a dense shelf far better than the cheap tier at default detail. We also ask the model for a 2D
 * bounding box per item: locating each thing forces it to actually *see* it, which is the documented
 * way to cut vision hallucination (it can't box something that isn't there). Presence is reported per
 * item so reconcile can treat presence as strong and absence as weak (§5.6). Labels are normalized to
 * canonical items downstream via the §5.4 cascade — here we only see + describe.
 */
import { z } from "zod";
import { GEMINI_MODELS, type GeminiTier } from "@gm/config/constants";
import { getGeminiClient, type GeminiClient, type ImagePart } from "../llm/client.js";

export type ScanLocation = "fridge" | "pantry" | "freezer" | "other";

/** A scan pays for accuracy: Flash (mid) by default, not the cheap tier. */
export const DEFAULT_SCAN_TIER: GeminiTier = "mid";
export const scanModelFor = (tier: GeminiTier): string => GEMINI_MODELS[tier];

export interface VisionDetection {
  label: string;
  qtyEstimate: number | null;
  unitGuess: string | null;
  presenceConfidence: number; // 0..1
  qtyConfidence: number | null;
  /** [ymin, xmin, ymax, xmax] normalized 0..1000 — grounding only; not persisted today. */
  box2d?: number[] | null;
}

const VisionDetectionSchema = z.object({
  detections: z.array(
    z.object({
      label: z.string(),
      qtyEstimate: z.number().nullable(),
      unitGuess: z.string().nullable(),
      presenceConfidence: z.number(),
      qtyConfidence: z.number().nullable(),
      box2d: z.array(z.number()).nullable(),
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
    `You are an expert grocery-inventory vision system looking at one or more photos of a ${location}.`,
    "Carefully scan EVERY shelf, door, drawer, and corner across ALL photos and list each distinct food,",
    "drink, or grocery/household item you can clearly see.",
    "",
    "Rules:",
    "- Use a short, generic, lowercase label — the food, not the marketing ('milk', 'baby spinach',",
    "  'greek yogurt', 'ketchup'), never a brand slogan or package copy.",
    "- For each item give box2d as [ymin, xmin, ymax, xmax] in coordinates normalized 0–1000, marking",
    "  where it sits in the image. Actually locating each item is required — do not list anything you",
    "  cannot point to.",
    "- If you can see several of the same item, set qtyEstimate to the count; otherwise estimate a",
    "  quantity + unit only when obvious, else leave them null.",
    "- presenceConfidence (0..1): ~1.0 for an unmistakable, fully-visible item; lower it for blurry or",
    "  partially-hidden ones. Do not list anything below ~0.4.",
    "- Do NOT guess at items hidden behind others or sealed inside opaque containers/jars — if you",
    "  can't see it, leave it out (a later step handles what photos can't show).",
    "- Ignore non-grocery clutter (hands, magnets, utensils, shelves themselves).",
    "Return JSON only, matching the schema.",
  ].join("\n");
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
    "Identify every grocery item visible in the attached photo(s).",
    {
      tier: opts.tier ?? DEFAULT_SCAN_TIER,
      system: systemPrompt(location),
      images,
      // Zoomed reframing — materially better at small / packed-shelf items.
      mediaResolution: "high",
    },
  );
  return res.detections;
}
