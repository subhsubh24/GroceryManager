/**
 * Thin media-generation adapter (GTM_STANDARD §11) — IMAGE / VIDEO / MUSIC / VOICEOVER on the SAME
 * Gemini key the rest of the pipeline runs on. There is no separate media-gen key to connect; the
 * only remaining owner step to go live is connecting the posting CHANNEL (Track H).
 *
 * Design mirrors the LLM cheap-first contract:
 *   - AUDIT-FIRST: every request runs the deterministic pre-publish audit (`auditMediaAsset`) BEFORE
 *     any paid call. A failing audit returns `rejected` and spends nothing — the maker≠checker gate is
 *     load-bearing, not advisory.
 *   - DEGRADE, NEVER THROW: no Gemini key configured → `unavailable`; any API failure/timeout →
 *     `error`. A media call must never block or crash the marketing loop (best-effort, same as receipt
 *     parse / macros / meal-gen).
 *   - PINNED PREVIEW IDS + COST GOVERNANCE: model ids come from `MEDIA_MODELS` (one place to re-pin
 *     when a preview id churns); every call is wall-clock bounded so a hung preview surface can't stall
 *     a job. Generation STAGES creative only — publishing stays gated (Track H / §13).
 *
 * The genuinely-visual "does it LOOK generated?" verdict needs a model to view the rendered asset and
 * is best-effort; the always-on, keyless half of the credibility bar is the deterministic `audit.ts`
 * gate that runs here first.
 */
import { GoogleGenAI } from "@google/genai";
import { loadEnv, useVertex, type Env } from "@gm/config/env";
import { MEDIA_MODELS, resolveImageModel, resolveMusicModel, type ImageQuality, type MediaFormat } from "./models.js";
import { auditMediaAsset, type MediaAuditInput, type MediaAuditResult } from "./audit.js";

/** Media generation is slower than text; still bounded so a hung preview surface can't stall a job. */
const DEFAULT_MEDIA_TIMEOUT_MS = 45_000;

export interface MediaAsset {
  format: MediaFormat;
  /** The pinned preview model id that produced (or is producing) the asset. */
  model: string;
  /** IANA MIME type (e.g. image/png, audio/wav). Empty for a still-pending video operation. */
  mimeType: string;
  /** Base64 payload for image / music / voiceover. Absent for video (see `operationName`). */
  dataBase64?: string;
  /**
   * VIDEO only: the long-running operation name to poll via `ai.operations.getVideosOperation`.
   * Video generation is async — the adapter kicks it off and returns the handle to poll later.
   */
  operationName?: string;
  /** The FTC AI-assisted disclosure that must ship with the asset. */
  disclosure: string;
  /** Every Gemini image/video/audio asset carries an invisible SynthID watermark (provenance-positive). */
  synthIdWatermarked: true;
}

export type MediaGenResult =
  | { status: "ok"; asset: MediaAsset; audit: MediaAuditResult }
  | { status: "rejected"; audit: MediaAuditResult }
  | { status: "unavailable"; reason: string }
  | { status: "error"; reason: string };

export interface ImageRequest extends MediaAuditInput {
  quality?: ImageQuality;
  /** Supported: "1:1", "3:4", "4:3", "9:16", "16:9". */
  aspectRatio?: string;
}

export interface VideoRequest extends MediaAuditInput {
  aspectRatio?: string;
  durationSeconds?: number;
}

export interface AudioRequest extends MediaAuditInput {
  /** MUSIC only: request the full-track model instead of the 30s clip. */
  fullTrack?: boolean;
}

/** Bound a single media call so a hung preview surface can't stall the job past a known ceiling. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`media timeout after ${ms}ms: ${label}`)), ms);
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

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class MediaGenClient {
  private readonly ai: GoogleGenAI;
  private readonly env: Env;

  constructor(env: Env = loadEnv()) {
    this.env = env;
    this.ai = useVertex(env)
      ? new GoogleGenAI({
          vertexai: true,
          project: env.GOOGLE_VERTEX_PROJECT,
          location: env.GOOGLE_VERTEX_LOCATION,
        })
      : new GoogleGenAI({ apiKey: env.GEMINI_API_KEY ?? "" });
  }

  private get timeoutMs(): number {
    return this.env.LLM_TIMEOUT_MS ?? DEFAULT_MEDIA_TIMEOUT_MS;
  }

  /** True when a real Gemini/Vertex credential is configured; otherwise every call degrades. */
  private get configured(): boolean {
    return useVertex(this.env) || Boolean(this.env.GEMINI_API_KEY);
  }

  /**
   * Run the pre-publish audit and the no-key degrade check that gate EVERY format. Returns a
   * terminal `MediaGenResult` to short-circuit on, or `null` when the request is clear to generate.
   */
  private preflight(input: MediaAuditInput): MediaGenResult | null {
    const audit = auditMediaAsset(input);
    if (!audit.pass) return { status: "rejected", audit };
    if (!this.configured) return { status: "unavailable", reason: "no-gemini-key" };
    return null;
  }

  async generateImage(req: ImageRequest): Promise<MediaGenResult> {
    const gate = this.preflight(req);
    if (gate) return gate;

    const model = resolveImageModel(req.quality);
    try {
      const res = await withTimeout(
        this.ai.models.generateImages({
          model,
          prompt: req.prompt,
          config: {
            numberOfImages: 1,
            ...(req.aspectRatio ? { aspectRatio: req.aspectRatio } : {}),
          },
        }),
        this.timeoutMs,
        `generateImage ${model}`,
      );
      const img = res.generatedImages?.[0]?.image;
      if (!img?.imageBytes) {
        return { status: "error", reason: `no image returned (model=${model})` };
      }
      return {
        status: "ok",
        audit: auditMediaAsset(req),
        asset: {
          format: "image",
          model,
          mimeType: img.mimeType ?? "image/png",
          dataBase64: img.imageBytes,
          disclosure: (req.disclosure ?? "").trim(),
          synthIdWatermarked: true,
        },
      };
    } catch (err) {
      return { status: "error", reason: errText(err) };
    }
  }

  async generateVideo(req: VideoRequest): Promise<MediaGenResult> {
    const gate = this.preflight(req);
    if (gate) return gate;

    const model = MEDIA_MODELS.video;
    try {
      const op = await withTimeout(
        this.ai.models.generateVideos({
          model,
          prompt: req.prompt,
          config: {
            numberOfVideos: 1,
            ...(req.aspectRatio ? { aspectRatio: req.aspectRatio } : {}),
            ...(req.durationSeconds ? { durationSeconds: req.durationSeconds } : {}),
          },
        }),
        this.timeoutMs,
        `generateVideo ${model}`,
      );
      if (!op.name) {
        return { status: "error", reason: `no video operation returned (model=${model})` };
      }
      // Video is a long-running operation — return the handle to poll via ai.operations later.
      return {
        status: "ok",
        audit: auditMediaAsset(req),
        asset: {
          format: "video",
          model,
          mimeType: "",
          operationName: op.name,
          disclosure: (req.disclosure ?? "").trim(),
          synthIdWatermarked: true,
        },
      };
    } catch (err) {
      return { status: "error", reason: errText(err) };
    }
  }

  async generateMusic(req: AudioRequest): Promise<MediaGenResult> {
    return this.generateAudio(req, "music", resolveMusicModel(req.fullTrack));
  }

  async generateVoiceover(req: AudioRequest): Promise<MediaGenResult> {
    return this.generateAudio(req, "voiceover", MEDIA_MODELS.voiceover);
  }

  /** Shared MUSIC/VOICEOVER path: both return inline audio bytes from a preview audio model. */
  private async generateAudio(
    req: AudioRequest,
    format: "music" | "voiceover",
    model: string,
  ): Promise<MediaGenResult> {
    const gate = this.preflight(req);
    if (gate) return gate;

    try {
      const res = await withTimeout(
        this.ai.models.generateContent({
          model,
          contents: { role: "user", parts: [{ text: req.prompt }] },
          config: { responseModalities: ["AUDIO"] },
        }),
        this.timeoutMs,
        `generate ${format} ${model}`,
      );
      const audioPart = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      const inline = audioPart?.inlineData;
      if (!inline?.data) {
        return { status: "error", reason: `no ${format} audio returned (model=${model})` };
      }
      return {
        status: "ok",
        audit: auditMediaAsset(req),
        asset: {
          format,
          model,
          mimeType: inline.mimeType ?? "audio/wav",
          dataBase64: inline.data,
          disclosure: (req.disclosure ?? "").trim(),
          synthIdWatermarked: true,
        },
      };
    } catch (err) {
      return { status: "error", reason: errText(err) };
    }
  }
}

let _client: MediaGenClient | null = null;

/** Shared media-gen adapter singleton (constructs from env on first use). */
export function getMediaGenClient(): MediaGenClient {
  if (!_client) _client = new MediaGenClient();
  return _client;
}
