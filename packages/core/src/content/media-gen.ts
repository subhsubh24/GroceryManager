/**
 * Marketing media-gen adapter (GTM_STANDARD §11 / ROADMAP §11).
 *
 * A thin, framework-agnostic adapter that produces multi-format marketing creative on the SAME
 * Gemini key the rest of the pipeline already uses — there is no separate media-gen key to hold or
 * connect. Formats:
 *   - IMAGE     via Nano Banana        (`gemini-3.1-flash-image`, lite/pro variants)   → base64 bytes
 *   - VIDEO     via Gemini Omni Flash  (`gemini-omni-flash-preview`)                    → long-running op
 *   - VOICEOVER via Gemini TTS         (`gemini-3.1-flash-tts-preview`)                 → base64 audio
 *   - MUSIC     via Lyria 3            (`lyria-3-clip-preview` / `lyria-3-pro-preview`) → base64 audio
 *
 * All generation models are PREVIEW: the ids are PINNED here and treated as unstable (API/pricing
 * may change without notice). Everything routes through `@google/genai` (never the SDK's transport
 * directly for callers) so the pipeline keeps ONE provider + ONE key + ONE cost contract.
 *
 * Discipline this adapter enforces / assumes:
 *   - BEST-EFFORT, never blocks: every call is wrapped in try/catch + a wall-clock timeout and returns
 *     a discriminated {status} envelope. It NEVER throws — a missing key, a preview-model rejection,
 *     or a timeout degrades to {status:"degraded"|"error"}, exactly like the rest of the LLM surface.
 *   - COST-GOVERNED: media generation costs real money. Callers pass a `canGenerate` guard (wire it to
 *     the per-user/day spend ceiling); when it returns false the adapter degrades WITHOUT spending.
 *   - PROVENANCE + FTC: every Gemini image/video/audio asset carries an invisible SynthID watermark
 *     (`synthIdWatermarked`), and `aiDisclosureRequired` is always true — the publish path MUST
 *     disclose "AI-assisted" per FTC AND pass the independent maker≠checker not-obviously-AI/credibility
 *     audit (GTM §11) BEFORE anything goes to a channel. This adapter GENERATES; it never publishes.
 */
import { GoogleGenAI, Modality } from "@google/genai";
import { loadEnv, useVertex, type Env } from "@gm/config/env";

/** PINNED preview model ids (GTM §11). Treat as unstable — bump here when Google promotes them. */
export const MEDIA_GEN_MODELS = {
  /** Nano Banana — the on-brand default for most images. */
  image: "gemini-3.1-flash-image",
  /** Cheap/high-volume image variant (thumbnails, batch experiments). */
  imageCheap: "gemini-3.1-flash-lite-image",
  /** Hero/marquee image quality. */
  imageHero: "gemini-3-pro-image",
  /** Short marketing video. */
  video: "gemini-omni-flash-preview",
  /** Voiceover / narration (controllable style/tone). */
  voiceover: "gemini-3.1-flash-tts-preview",
  /** 30s music/soundtrack clip. */
  musicClip: "lyria-3-clip-preview",
  /** Full music track. */
  musicPro: "lyria-3-pro-preview",
} as const;

/** Media generation is slower than text — allow a generous default (this runs in workers, not on the
 *  serverless request path). Override per call. Kept well under a typical worker job budget. */
export const DEFAULT_MEDIA_TIMEOUT_MS = 60_000;

export type MediaFormat = "image" | "video" | "voiceover" | "music";

export interface MediaAsset {
  format: MediaFormat;
  /** The exact pinned preview model id used. */
  model: string;
  mimeType: string;
  /** base64-encoded bytes for image / voiceover / music. Absent for video (see `operationName`). */
  dataBase64?: string;
  /**
   * Video generation is long-running: the SDK returns an operation immediately and the bytes arrive
   * minutes later. `operationName` is the handle a worker polls; `done` is the initial status.
   */
  operationName?: string;
  done?: boolean;
  /** Gemini media carries an invisible SynthID watermark — always true for assets from this adapter. */
  synthIdWatermarked: true;
  /** The publish path MUST disclose AI-assistance (FTC) — always true. */
  aiDisclosureRequired: true;
}

export type DegradeReason = "no_api_key" | "budget_exceeded";

export type MediaGenResult =
  | { status: "ok"; asset: MediaAsset }
  | { status: "degraded"; reason: DegradeReason }
  | { status: "error"; reason: string };

export interface MediaGenOptions {
  /** Per-call wall-clock budget (ms). Defaults to {@link DEFAULT_MEDIA_TIMEOUT_MS}. */
  timeoutMs?: number;
  /**
   * Cost governance guard. Called BEFORE any paid generation; return false to skip (degrades to
   * `budget_exceeded` without spending). Wire this to the per-user/day API spend ceiling.
   */
  canGenerate?: () => boolean | Promise<boolean>;
}

export interface ImageGenOptions extends MediaGenOptions {
  /** cheap = flash-lite-image, standard = flash-image (default), hero = pro-image. */
  quality?: "cheap" | "standard" | "hero";
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
}

export interface VoiceoverOptions extends MediaGenOptions {
  /** Prebuilt Gemini TTS voice name (style/tone). Omitted → the model default. */
  voiceName?: string;
}

export interface MusicOptions extends MediaGenOptions {
  /** clip = 30s (default), full = complete track. */
  length?: "clip" | "full";
}

/** Reject `p` if it doesn't settle within `ms`, so one stuck media call can't hang a worker job. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`media-gen call exceeded ${ms}ms timeout (${label})`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function makeAsset(
  format: MediaFormat,
  model: string,
  mimeType: string,
  extra: Partial<Pick<MediaAsset, "dataBase64" | "operationName" | "done">>,
): MediaAsset {
  return {
    format,
    model,
    mimeType,
    synthIdWatermarked: true,
    aiDisclosureRequired: true,
    ...extra,
  };
}

/**
 * Multi-format marketing creative generator. Best-effort + cost-governed + degrades without a key.
 * Construct once (reads env at construction), reuse across a batch.
 */
export class MediaGenClient {
  private readonly ai: GoogleGenAI | null;

  constructor(env: Env = loadEnv()) {
    const hasKey = useVertex(env) ? Boolean(env.GOOGLE_VERTEX_PROJECT) : Boolean(env.GEMINI_API_KEY);
    if (!hasKey) {
      // No credentials → degrade every call to `no_api_key`. Never construct a client that would
      // throw or hang on the first request (matches the best-effort LLM convention).
      this.ai = null;
    } else if (useVertex(env)) {
      this.ai = new GoogleGenAI({
        vertexai: true,
        project: env.GOOGLE_VERTEX_PROJECT,
        location: env.GOOGLE_VERTEX_LOCATION,
      });
    } else {
      this.ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    }
  }

  /** True when a key/project is configured — callers can skip staging work when generation is a no-op. */
  get available(): boolean {
    return this.ai !== null;
  }

  /**
   * Shared guard + envelope: enforce key presence and the cost ceiling, run `fn` under a timeout, and
   * map any throw to `{status:"error"}`. `fn` returns the OK/error envelope; degrade paths short-circuit.
   */
  private async run(
    opts: MediaGenOptions,
    label: string,
    fn: (ai: GoogleGenAI) => Promise<MediaGenResult>,
  ): Promise<MediaGenResult> {
    if (!this.ai) return { status: "degraded", reason: "no_api_key" };
    if (opts.canGenerate) {
      try {
        if (!(await opts.canGenerate())) return { status: "degraded", reason: "budget_exceeded" };
      } catch {
        // A failing budget check must FAIL CLOSED — never spend when we can't confirm headroom.
        return { status: "degraded", reason: "budget_exceeded" };
      }
    }
    try {
      return await withTimeout(fn(this.ai), opts.timeoutMs ?? DEFAULT_MEDIA_TIMEOUT_MS, label);
    } catch (e) {
      return { status: "error", reason: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Generate a still image (Nano Banana). Returns the first image as base64 bytes. */
  async generateImage(prompt: string, opts: ImageGenOptions = {}): Promise<MediaGenResult> {
    const model =
      opts.quality === "hero"
        ? MEDIA_GEN_MODELS.imageHero
        : opts.quality === "cheap"
          ? MEDIA_GEN_MODELS.imageCheap
          : MEDIA_GEN_MODELS.image;
    return this.run(opts, `image ${model}`, async (ai) => {
      const res = await ai.models.generateImages({
        model,
        prompt,
        config: {
          numberOfImages: 1,
          ...(opts.aspectRatio ? { aspectRatio: opts.aspectRatio } : {}),
        },
      });
      const image = res.generatedImages?.[0]?.image;
      if (!image?.imageBytes) {
        const raiReason = res.generatedImages?.[0]?.raiFilteredReason;
        return {
          status: "error",
          reason: raiReason ? `image filtered: ${raiReason}` : "no_image_returned",
        };
      }
      return {
        status: "ok",
        asset: makeAsset("image", model, image.mimeType ?? "image/png", {
          dataBase64: image.imageBytes,
        }),
      };
    });
  }

  /**
   * Start a video generation (Gemini Omni Flash). Video is long-running: this returns the operation
   * handle immediately; a worker polls `operationName` for the finished bytes. `done` is the initial
   * status (almost always false — poll to completion).
   */
  async generateVideo(prompt: string, opts: MediaGenOptions = {}): Promise<MediaGenResult> {
    const model = MEDIA_GEN_MODELS.video;
    return this.run(opts, `video ${model}`, async (ai) => {
      const op = await ai.models.generateVideos({ model, prompt });
      if (!op.name) return { status: "error", reason: "no_operation_returned" };
      return {
        status: "ok",
        asset: makeAsset("video", model, "video/mp4", {
          operationName: op.name,
          done: op.done ?? false,
        }),
      };
    });
  }

  /** Generate spoken voiceover / narration (Gemini TTS). Returns base64 audio. */
  async generateVoiceover(script: string, opts: VoiceoverOptions = {}): Promise<MediaGenResult> {
    const model = MEDIA_GEN_MODELS.voiceover;
    return this.run(opts, `voiceover ${model}`, async (ai) => {
      const res = await ai.models.generateContent({
        model,
        contents: { role: "user", parts: [{ text: script }] },
        config: {
          responseModalities: [Modality.AUDIO],
          ...(opts.voiceName
            ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voiceName } } } }
            : {}),
        },
      });
      return extractAudio(res, "voiceover", model);
    });
  }

  /**
   * Generate a music clip / soundtrack (Lyria 3). Returns base64 audio. Lyria is a preview model on
   * the same key; a preview rejection degrades to `{status:"error"}` (honest — never a fake success).
   */
  async generateMusic(prompt: string, opts: MusicOptions = {}): Promise<MediaGenResult> {
    const model = opts.length === "full" ? MEDIA_GEN_MODELS.musicPro : MEDIA_GEN_MODELS.musicClip;
    return this.run(opts, `music ${model}`, async (ai) => {
      const res = await ai.models.generateContent({
        model,
        contents: { role: "user", parts: [{ text: prompt }] },
        config: { responseModalities: [Modality.AUDIO] },
      });
      return extractAudio(res, "music", model);
    });
  }
}

/** Pull the first inline audio part out of a generateContent response into an OK/error envelope. */
function extractAudio(
  res: { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }> },
  format: "voiceover" | "music",
  model: string,
): MediaGenResult {
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  const audio = parts.find((p) => p.inlineData?.data && p.inlineData.mimeType?.startsWith("audio/"));
  const data = audio?.inlineData?.data;
  if (!data) return { status: "error", reason: "no_audio_returned" };
  return {
    status: "ok",
    asset: makeAsset(format, model, audio!.inlineData!.mimeType ?? "audio/wav", { dataBase64: data }),
  };
}
