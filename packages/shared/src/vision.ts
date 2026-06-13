import { z } from "zod";

/**
 * VisionScanExtraction — Gemini vision output for a fridge/pantry photo (PLAN §5.6).
 * Presence is a strong signal; quantity is a weaker one (separate confidences).
 * Absence is NOT encoded here — non-detection is handled by the reconciler, never auto-zeroed.
 */
export const ScanLocation = z.enum(["fridge", "pantry", "freezer", "other"]);
export type ScanLocation = z.infer<typeof ScanLocation>;

export const VisionDetection = z.object({
  label: z.string(), // what the model sees, e.g. "carton of oat milk"
  canonicalGuess: z.string().nullable(), // best canonical-item guess (resolved later by the cascade)
  qtyEstimate: z.number().nullable(),
  unitGuess: z.string().nullable(),
  boundingBox: z
    .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
    .nullable(),
  presenceConfidence: z.number().min(0).max(1),
  qtyConfidence: z.number().min(0).max(1),
});
export type VisionDetection = z.infer<typeof VisionDetection>;

export const VisionScanExtraction = z.object({
  location: ScanLocation,
  detections: z.array(VisionDetection),
});
export type VisionScanExtraction = z.infer<typeof VisionScanExtraction>;
