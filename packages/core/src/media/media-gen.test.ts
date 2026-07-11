import { describe, expect, it } from "vitest";
import type { Env } from "@gm/config/env";
import { MediaGenClient } from "./media-gen.js";
import { MEDIA_MODELS, resolveImageModel, resolveMusicModel } from "./models.js";

/** A minimal env with NO Gemini/Vertex credential — every real call must degrade, none hits network. */
const NO_KEY_ENV = {
  GEMINI_API_KEY: undefined,
  GOOGLE_VERTEX_PROJECT: undefined,
  GOOGLE_VERTEX_LOCATION: "us-central1",
} as unknown as Env;

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
