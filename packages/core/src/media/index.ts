/**
 * Media-generation adapter (GTM_STANDARD §11) — the thin, best-effort, degrade-by-default surface for
 * multi-format marketing creative (image / video / music / voiceover) on the existing Gemini key.
 * Publishing stays gated (Track H / §13); this module only STAGES + audits creative.
 */
export {
  MEDIA_MODELS,
  resolveImageModel,
  resolveMusicModel,
  type MediaFormat,
  type ImageQuality,
} from "./models.js";
export {
  auditMediaAsset,
  type MediaAuditInput,
  type MediaAuditResult,
  type MediaAuditViolation,
} from "./audit.js";
export {
  MediaGenClient,
  getMediaGenClient,
  type MediaAsset,
  type MediaGenResult,
  type ImageRequest,
  type VideoRequest,
  type AudioRequest,
} from "./media-gen.js";
