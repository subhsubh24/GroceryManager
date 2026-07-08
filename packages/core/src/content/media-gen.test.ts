/**
 * Media-gen adapter tests (GTM §11). KEYLESS — the `@google/genai` SDK is mocked wholesale, so these
 * exercise the adapter's real orchestration (model selection, param passthrough, envelope shaping,
 * cost-governance, degrade paths, timeout) without a network call or an API key. The credibility /
 * not-obviously-AI audit is a downstream maker≠checker gate, not this adapter's job.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "@gm/config/env";

// --- controllable SDK mock -------------------------------------------------
// Each test sets these; the mocked GoogleGenAI instance delegates to them.
const generateImages = vi.fn();
const generateVideos = vi.fn();
const generateContent = vi.fn();
let lastCtorArgs: unknown;

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateImages, generateVideos, generateContent };
    constructor(args: unknown) {
      lastCtorArgs = args;
    }
  },
  Modality: { AUDIO: "AUDIO", TEXT: "TEXT", IMAGE: "IMAGE", VIDEO: "VIDEO" },
}));

import {
  MediaGenClient,
  MEDIA_GEN_MODELS,
  type MediaGenResult,
} from "./media-gen.js";

const keyEnv = { GEMINI_API_KEY: "test-key", GOOGLE_VERTEX_LOCATION: "us-central1" } as unknown as Env;
const noKeyEnv = { GOOGLE_VERTEX_LOCATION: "us-central1" } as unknown as Env;

afterEach(() => {
  vi.clearAllMocks();
});

describe("MediaGenClient — degrade without credentials", () => {
  it("reports unavailable and never constructs a client when no key/project is set", async () => {
    const c = new MediaGenClient(noKeyEnv);
    expect(c.available).toBe(false);
    const results = await Promise.all([
      c.generateImage("a fresh pantry"),
      c.generateVideo("a 15s demo"),
      c.generateVoiceover("save money on groceries"),
      c.generateMusic("upbeat kitchen"),
    ]);
    for (const r of results) {
      expect(r).toEqual({ status: "degraded", reason: "no_api_key" });
    }
    // No SDK call was ever attempted.
    expect(generateImages).not.toHaveBeenCalled();
    expect(generateVideos).not.toHaveBeenCalled();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("is available when a key is present", () => {
    expect(new MediaGenClient(keyEnv).available).toBe(true);
    expect(lastCtorArgs).toEqual({ apiKey: "test-key" });
  });

  it("uses Vertex when a project is configured (no raw key needed)", () => {
    const vertexEnv = {
      GOOGLE_VERTEX_PROJECT: "proj",
      GOOGLE_VERTEX_LOCATION: "us-central1",
    } as unknown as Env;
    expect(new MediaGenClient(vertexEnv).available).toBe(true);
    expect(lastCtorArgs).toMatchObject({ vertexai: true, project: "proj" });
  });
});

describe("MediaGenClient — cost governance", () => {
  it("degrades to budget_exceeded WITHOUT spending when the guard denies", async () => {
    const c = new MediaGenClient(keyEnv);
    const r = await c.generateImage("hero shot", { canGenerate: () => false });
    expect(r).toEqual({ status: "degraded", reason: "budget_exceeded" });
    expect(generateImages).not.toHaveBeenCalled();
  });

  it("fails CLOSED (budget_exceeded) when the guard itself throws", async () => {
    const c = new MediaGenClient(keyEnv);
    const r = await c.generateImage("hero shot", {
      canGenerate: () => {
        throw new Error("spend-ledger down");
      },
    });
    expect(r).toEqual({ status: "degraded", reason: "budget_exceeded" });
    expect(generateImages).not.toHaveBeenCalled();
  });

  it("proceeds when the (async) guard allows", async () => {
    generateImages.mockResolvedValue({
      generatedImages: [{ image: { imageBytes: "AAAA", mimeType: "image/png" } }],
    });
    const c = new MediaGenClient(keyEnv);
    const r = await c.generateImage("hero shot", { canGenerate: async () => true });
    expect(r.status).toBe("ok");
    expect(generateImages).toHaveBeenCalledTimes(1);
  });
});

describe("MediaGenClient.generateImage", () => {
  function okImage() {
    generateImages.mockResolvedValue({
      generatedImages: [{ image: { imageBytes: "Zm9v", mimeType: "image/webp" } }],
    });
  }

  it("returns base64 bytes + provenance flags on success", async () => {
    okImage();
    const r = await new MediaGenClient(keyEnv).generateImage("a bright pantry");
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.asset).toMatchObject({
      format: "image",
      model: MEDIA_GEN_MODELS.image,
      mimeType: "image/webp",
      dataBase64: "Zm9v",
      synthIdWatermarked: true,
      aiDisclosureRequired: true,
    });
  });

  it("selects the pinned model per quality tier", async () => {
    okImage();
    const c = new MediaGenClient(keyEnv);
    await c.generateImage("x", { quality: "cheap" });
    expect(generateImages.mock.calls[0]![0].model).toBe(MEDIA_GEN_MODELS.imageCheap);
    await c.generateImage("x", { quality: "hero" });
    expect(generateImages.mock.calls[1]![0].model).toBe(MEDIA_GEN_MODELS.imageHero);
    await c.generateImage("x");
    expect(generateImages.mock.calls[2]![0].model).toBe(MEDIA_GEN_MODELS.image);
  });

  it("passes aspectRatio through to the SDK config", async () => {
    okImage();
    await new MediaGenClient(keyEnv).generateImage("x", { aspectRatio: "9:16" });
    expect(generateImages.mock.calls[0]![0].config).toMatchObject({
      numberOfImages: 1,
      aspectRatio: "9:16",
    });
  });

  it("surfaces the RAI filter reason as an error (no fake success)", async () => {
    generateImages.mockResolvedValue({
      generatedImages: [{ raiFilteredReason: "safety" }],
    });
    const r = await new MediaGenClient(keyEnv).generateImage("x");
    expect(r).toEqual({ status: "error", reason: "image filtered: safety" });
  });

  it("returns an error when no bytes come back", async () => {
    generateImages.mockResolvedValue({ generatedImages: [] });
    const r = await new MediaGenClient(keyEnv).generateImage("x");
    expect(r).toEqual({ status: "error", reason: "no_image_returned" });
  });

  it("degrades a thrown SDK error to {status:error} — never throws to the caller", async () => {
    generateImages.mockRejectedValue(new Error("500 model unavailable"));
    const r = await new MediaGenClient(keyEnv).generateImage("x");
    expect(r).toEqual({ status: "error", reason: "500 model unavailable" });
  });
});

describe("MediaGenClient.generateVideo", () => {
  it("returns the long-running operation handle to poll", async () => {
    generateVideos.mockResolvedValue({ name: "operations/abc123", done: false });
    const r = await new MediaGenClient(keyEnv).generateVideo("a 15s demo");
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.asset).toMatchObject({
      format: "video",
      model: MEDIA_GEN_MODELS.video,
      mimeType: "video/mp4",
      operationName: "operations/abc123",
      done: false,
    });
    expect(r.asset.dataBase64).toBeUndefined();
  });

  it("errors when the SDK returns no operation name", async () => {
    generateVideos.mockResolvedValue({ done: false });
    const r = await new MediaGenClient(keyEnv).generateVideo("x");
    expect(r).toEqual({ status: "error", reason: "no_operation_returned" });
  });
});

describe("MediaGenClient audio (voiceover + music)", () => {
  function okAudio(mime = "audio/wav") {
    generateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ inlineData: { data: "QUJD", mimeType: mime } }] } }],
    });
  }

  it("voiceover returns base64 audio and requests the AUDIO modality", async () => {
    okAudio("audio/mpeg");
    const r = await new MediaGenClient(keyEnv).generateVoiceover("save on groceries", {
      voiceName: "Kore",
    });
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.asset).toMatchObject({
      format: "voiceover",
      model: MEDIA_GEN_MODELS.voiceover,
      mimeType: "audio/mpeg",
      dataBase64: "QUJD",
    });
    const cfg = generateContent.mock.calls[0]![0].config;
    expect(cfg.responseModalities).toEqual(["AUDIO"]);
    expect(cfg.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe("Kore");
  });

  it("music selects the clip model by default and the pro model for a full track", async () => {
    okAudio();
    const c = new MediaGenClient(keyEnv);
    await c.generateMusic("upbeat kitchen");
    expect(generateContent.mock.calls[0]![0].model).toBe(MEDIA_GEN_MODELS.musicClip);
    await c.generateMusic("upbeat kitchen", { length: "full" });
    expect(generateContent.mock.calls[1]![0].model).toBe(MEDIA_GEN_MODELS.musicPro);
  });

  it("errors (no fake success) when the response carries no audio part", async () => {
    generateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "sorry" }] } }],
    });
    const r = await new MediaGenClient(keyEnv).generateMusic("x");
    expect(r).toEqual({ status: "error", reason: "no_audio_returned" });
  });
});

describe("MediaGenClient — timeout", () => {
  it("rejects a stuck call as {status:error} within the configured budget", async () => {
    generateImages.mockImplementation(() => new Promise(() => {})); // never settles
    const r: MediaGenResult = await new MediaGenClient(keyEnv).generateImage("x", { timeoutMs: 10 });
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.reason).toMatch(/timeout/i);
  });
});
