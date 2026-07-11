/**
 * Maker≠checker pre-publish audit for generated marketing creative (GTM_STANDARD §11).
 *
 * Content you publish IS the brand in the wild: AI-slop destroys credibility, and undisclosed
 * AI-assisted creative is an FTC problem. This gate runs BEFORE any asset is staged for publish and
 * is deliberately PURE + deterministic so it is validated keyless in CI — the "call that wrote it
 * doesn't grade it" split, same principle as the LLM verifier.
 *
 * It enforces the two hard, mechanical requirements that do NOT need to look at the pixels:
 *   1. FTC disclosure — a non-empty AI-assisted disclosure must accompany the asset.
 *   2. Not-obviously-AI (prompt smell) — the generation prompt / caption must not lean on the curated
 *      slop vocabulary below that reliably PRODUCES obvious-AI output. This operationalizes VISION's
 *      anti-slop PRINCIPLE ("never obviously AI-generated") for image/video prompts; the specific
 *      terms are a curated media-gen denylist, not a quote from VISION's (UI-focused) avoid list.
 *
 * The remaining, genuinely-visual "does this LOOK generated?" verdict needs a model to view the
 * rendered asset; that lives in the (best-effort, degradable) generation path, not here. This gate is
 * the load-bearing, always-on, keyless half — an asset that fails it is never staged.
 */

/** The minimum an FTC-compliant disclosure must convey: that AI was involved. */
const AI_DISCLOSURE_TERMS = ["ai", "generated", "synthetic", "assisted"];

/**
 * Curated denylist of prompt/caption vocabulary that reliably yields obvious-AI slop (generic
 * text-to-image clichés). A creative prompt reaching for these is a smell to reject, not a hard ban on
 * the concept — the author should describe the concrete scene instead of chasing a generator cliché.
 * Not sourced from a doc; extend it as new clichés surface.
 */
const SLOP_TERMS = [
  "hyper-realistic",
  "hyperrealistic",
  "ultra-realistic",
  "vibrant colors",
  "vibrant color",
  "trending on artstation",
  "8k",
  "4k render",
  "octane render",
  "unreal engine",
  "photorealistic render",
  "digital art",
  "cinematic lighting",
  "highly detailed",
  "award-winning",
  "stock photo",
  "gradient background",
  "glowing",
  "neon glow",
  "rainbow",
  "in the style of",
];

export type MediaAuditViolation =
  | { kind: "missing-disclosure"; detail: string }
  | { kind: "weak-disclosure"; detail: string }
  | { kind: "slop-prompt"; detail: string };

export interface MediaAuditInput {
  /** The generation prompt (image/video/music/voiceover). */
  prompt: string;
  /** Optional human-facing caption/copy that will ship alongside the asset. */
  caption?: string;
  /** The AI-assisted disclosure that will be published with the asset (FTC). */
  disclosure?: string;
}

export interface MediaAuditResult {
  /** True only when there are zero violations — the asset may be staged for publish. */
  pass: boolean;
  violations: MediaAuditViolation[];
}

function containsSlop(text: string): string[] {
  const lower = text.toLowerCase();
  return SLOP_TERMS.filter((term) => lower.includes(term));
}

/**
 * Deterministic pre-publish gate. Returns every violation (not just the first) so a caller can
 * surface the full list to whoever is iterating on the creative. `pass` is true only when clean.
 */
export function auditMediaAsset(input: MediaAuditInput): MediaAuditResult {
  const violations: MediaAuditViolation[] = [];

  // 1. FTC — a disclosure must be present and actually convey AI involvement.
  const disclosure = (input.disclosure ?? "").trim();
  if (disclosure.length === 0) {
    violations.push({
      kind: "missing-disclosure",
      detail: "no AI-assisted disclosure supplied (FTC requires one on generated creative)",
    });
  } else {
    const lower = disclosure.toLowerCase();
    if (!AI_DISCLOSURE_TERMS.some((t) => lower.includes(t))) {
      violations.push({
        kind: "weak-disclosure",
        detail: `disclosure does not convey AI involvement (expected one of: ${AI_DISCLOSURE_TERMS.join(", ")})`,
      });
    }
  }

  // 2. Not-obviously-AI — reject slop vocabulary in the prompt AND any shipping caption.
  const promptSlop = containsSlop(input.prompt);
  if (promptSlop.length > 0) {
    violations.push({
      kind: "slop-prompt",
      detail: `prompt uses obvious-AI slop terms: ${promptSlop.join(", ")}`,
    });
  }
  if (input.caption) {
    const captionSlop = containsSlop(input.caption);
    if (captionSlop.length > 0) {
      violations.push({
        kind: "slop-prompt",
        detail: `caption uses obvious-AI slop terms: ${captionSlop.join(", ")}`,
      });
    }
  }

  return { pass: violations.length === 0, violations };
}
