import { describe, expect, it } from "vitest";
import type { Env } from "@gm/config/env";
import { MediaGenClient, type MediaProvider } from "./media-gen.js";
import { MEDIA_MODELS, resolveImageModel, resolveMusicModel } from "./models.js";

/** A minimal env with NO Gemini/Vertex credential — every real call must degrade, none hits network. */
const NO_KEY_ENV = {
  GEMINI_API_KEY: undefined,
  GOOGLE_VERTEX_PROJECT: undefined,
  GOOGLE_VERTEX_LOCATION: "us-central1",
} as unknown as Env;

/** A KEYED env so preflight passes and the (fake) provider is actually called. */
function keyedEnv(mediaTimeoutMs = 1_000): Env {
  return {
    GEMINI_API_KEY: "test-key",
    GOOGLE_VERTEX_PROJECT: undefined,
    GOOGLE_VERTEX_LOCATION: "us-central1",
    MEDIA_TIMEOUT_MS: mediaTimeoutMs,
  } as unknown as Env;
}

/** Build a fake provider from partial model-method overrides (cast past the full SDK signatures). */
function fakeProvider(models: Record<string, unknown>): MediaProvider {
  return { models } as unknown as MediaProvider;
}

const CLEAN = {
  prompt: "A weekly grocery pantry on a wooden counter, natural window light, top-down.",
  disclosure: "Image created with AI assistance.",
};

describe("resolveImageModel / resolveMusicModel — pinned preview ids", () => {
  it("maps quality bands to the pinned Nano Banana ids", () => {
    expect(resolveImageModel("cheap")).toBe(MEDIA_MODELS.imageCheap);
    expect(resolveImageModel("default")).toBe(MEDIA_MODELS.image);
    expect(resolveImageModel("pro")).toBe(MEDIA_MODELS.imagePro);
    expect(resolveImageModel()).toBe(MEDIA_MODELS.image);
  });

  it("maps the music track flag to clip vs full Lyria ids", () => {
    expect(resolveMusicModel(false)).toBe(MEDIA_MODELS.music);
    expect(resolveMusicModel(true)).toBe(MEDIA_MODELS.musicPro);
  });

  it("every pinned id is a non-empty preview string", () => {
    for (const id of Object.values(MEDIA_MODELS)) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });
});

describe("MediaGenClient — degrade-by-default (no key)", () => {
  const client = new MediaGenClient(NO_KEY_ENV);

  it("generateImage degrades to unavailable without a key (no throw, no network)", async () => {
    const r = await client.generateImage(CLEAN);
    expect(r.status).toBe("unavailable");
    if (r.status === "unavailable") expect(r.reason).toBe("no-gemini-key");
  });

  it("generateVideo degrades to unavailable without a key", async () => {
    const r = await client.generateVideo(CLEAN);
    expect(r.status).toBe("unavailable");
  });

  it("generateMusic degrades to unavailable without a key", async () => {
    const r = await client.generateMusic(CLEAN);
    expect(r.status).toBe("unavailable");
  });

  it("generateVoiceover degrades to unavailable without a key", async () => {
    const r = await client.generateVoiceover({
      prompt: "Read this line in a warm, calm tone.",
      disclosure: "AI-generated voiceover.",
    });
    expect(r.status).toBe("unavailable");
  });
});

describe("MediaGenClient — audit-first (spends nothing on bad creative)", () => {
  const client = new MediaGenClient(NO_KEY_ENV);

  it("rejects a slop prompt BEFORE the key check (audit precedes generation)", async () => {
    const r = await client.generateImage({
      prompt: "hyper-realistic 8k octane render, vibrant colors",
      disclosure: "AI-generated.",
    });
    // Rejected by the audit gate — NOT 'unavailable' — proving the gate runs before any spend.
    expect(r.status).toBe("rejected");
    if (r.status === "rejected") {
      expect(r.audit.pass).toBe(false);
      expect(r.audit.violations.some((v) => v.kind === "slop-prompt")).toBe(true);
    }
  });

  it("rejects a missing-disclosure request before generating", async () => {
    const r = await client.generateImage({ prompt: "A tidy pantry shelf in soft daylight." });
    expect(r.status).toBe("rejected");
  });
});

describe("MediaGenClient — real-call paths via an injected provider (keyless)", () => {
  it("maps a returned image to an ok asset with bytes + disclosure + watermark flag", async () => {
    const provider = fakeProvider({
      generateImages: async () => ({
        generatedImages: [{ image: { imageBytes: "IMG_B64", mimeType: "image/png" } }],
      }),
    });
    const client = new MediaGenClient(keyedEnv(), provider);
    const r = await client.generateImage(CLEAN);
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.asset.format).toBe("image");
      expect(r.asset.dataBase64).toBe("IMG_B64");
      expect(r.asset.mimeType).toBe("image/png");
      expect(r.asset.disclosure).toBe(CLEAN.disclosure);
      expect(r.asset.synthIdWatermarked).toBe(true);
      expect(r.asset.model).toBe(MEDIA_MODELS.image);
    }
  });

  it("returns the operation name for a kicked-off video (async long-running op)", async () => {
    const provider = fakeProvider({
      generateVideos: async () => ({ name: "operations/abc123" }),
    });
    const client = new MediaGenClient(keyedEnv(), provider);
    const r = await client.generateVideo(CLEAN);
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.asset.format).toBe("video");
      expect(r.asset.operationName).toBe("operations/abc123");
      expect(r.asset.dataBase64).toBeUndefined();
    }
  });

  it("maps returned inline audio to an ok voiceover asset", async () => {
    const provider = fakeProvider({
      generateContent: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { data: "AUD_B64", mimeType: "audio/wav" } }] } }],
      }),
    });
    const client = new MediaGenClient(keyedEnv(), provider);
    const r = await client.generateVoiceover({
      prompt: "Read this warmly.",
      disclosure: "AI-generated voiceover.",
    });
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.asset.format).toBe("voiceover");
      expect(r.asset.dataBase64).toBe("AUD_B64");
      expect(r.asset.model).toBe(MEDIA_MODELS.voiceover);
    }
  });

  it("degrades a provider THROW to error (never throws to the caller)", async () => {
    const provider = fakeProvider({
      generateImages: async () => {
        throw new Error("boom");
      },
    });
    const client = new MediaGenClient(keyedEnv(), provider);
    const r = await client.generateImage(CLEAN);
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.reason).toContain("boom");
  });

  it("degrades a returned-but-empty response to error", async () => {
    const provider = fakeProvider({ generateImages: async () => ({ generatedImages: [] }) });
    const client = new MediaGenClient(keyedEnv(), provider);
    const r = await client.generateImage(CLEAN);
    expect(r.status).toBe("error");
  });

  it("bounds a hung provider call by MEDIA_TIMEOUT_MS -> error", async () => {
    const provider = fakeProvider({
      generateImages: () => new Promise(() => {}), // never resolves
    });
    const client = new MediaGenClient(keyedEnv(20), provider);
    const r = await client.generateImage(CLEAN);
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.reason).toMatch(/timeout/i);
  });
});
