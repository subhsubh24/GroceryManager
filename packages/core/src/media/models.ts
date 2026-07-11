/**
 * Pinned PREVIEW media-generation model ids (GTM_STANDARD §11).
 *
 * All four creative surfaces run on the SAME Gemini key the rest of the pipeline already uses — there
 * is no separate media-gen key to hold or connect. Every id here is a PREVIEW model: the API surface
 * and pricing may change without notice, so we PIN the ids in this one place and treat every call as
 * best-effort — the adapter degrades to `unavailable` rather than throwing when a preview id is
 * unconfigured or the surface is unavailable (mirrors the LLM cheap-first best-effort contract).
 */

export const MEDIA_MODELS = {
  /** IMAGE — Nano Banana. `image` is the default; `imageCheap` for high-volume, `imagePro` for hero. */
  image: "gemini-3.1-flash-image",
  imageCheap: "gemini-3.1-flash-lite-image",
  imagePro: "gemini-3-pro-image",
  /** VIDEO — Gemini Omni Flash (returns a long-running operation, polled via `ai.operations`). */
  video: "gemini-omni-flash-preview",
  /** MUSIC / soundtrack — Lyria 3. `music` is a 30s clip; `musicPro` a full track. */
  music: "lyria-3-clip-preview",
  musicPro: "lyria-3-pro-preview",
  /** VOICEOVER / narration — Gemini TTS (controllable style/tone). */
  voiceover: "gemini-3.1-flash-tts-preview",
} as const;

/** The four sanctioned creative formats. */
export type MediaFormat = "image" | "video" | "music" | "voiceover";

/** Quality band for image generation — maps to the cheap / default / pro Nano Banana ids. */
export type ImageQuality = "cheap" | "default" | "pro";

/** Resolve the concrete pinned image model id for a quality band. */
export function resolveImageModel(quality: ImageQuality = "default"): string {
  switch (quality) {
    case "cheap":
      return MEDIA_MODELS.imageCheap;
    case "pro":
      return MEDIA_MODELS.imagePro;
    default:
      return MEDIA_MODELS.image;
  }
}

/** Resolve the concrete pinned music model id (30s clip vs full track). */
export function resolveMusicModel(full = false): string {
  return full ? MEDIA_MODELS.musicPro : MEDIA_MODELS.music;
}
