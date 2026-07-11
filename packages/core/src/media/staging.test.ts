import { describe, expect, it } from "vitest";
import type { Env } from "@gm/config/env";
import { MediaGenClient, type MediaProvider, type MediaGenResult } from "./media-gen.js";
import { MEDIA_MODELS } from "./models.js";
import { stageCreative, serializeManifest, type CreativeBrief } from "./staging.js";

/** No credential — every real call degrades to `unavailable`, none hits the network. */
const NO_KEY_ENV = {
  GEMINI_API_KEY: undefined,
  GOOGLE_VERTEX_PROJECT: undefined,
  GOOGLE_VERTEX_LOCATION: "us-central1",
} as unknown as Env;

/** A KEYED env so preflight passes and the injected fake provider is actually called. */
function keyedEnv(mediaTimeoutMs = 1_000): Env {
  return {
    GEMINI_API_KEY: "test-key",
    GOOGLE_VERTEX_PROJECT: undefined,
    GOOGLE_VERTEX_LOCATION: "us-central1",
    MEDIA_TIMEOUT_MS: mediaTimeoutMs,
  } as unknown as Env;
}

function fakeProvider(models: Record<string, unknown>): MediaProvider {
  return { models } as unknown as MediaProvider;
}

/** A provider that answers all four adapter methods with a valid asset. */
function allOkProvider(): MediaProvider {
  return fakeProvider({
    generateImages: async () => ({
      generatedImages: [{ image: { imageBytes: "SU1BR0VfQllURVM=", mimeType: "image/png" } }],
    }),
    generateVideos: async () => ({ name: "operations/vid-123" }),
    generateContent: async () => ({
      candidates: [{ content: { parts: [{ inlineData: { data: "QVVESU9fQllURVM=", mimeType: "audio/wav" } }] } }],
    }),
  });
}

const FIXED_NOW = new Date("2026-07-11T00:00:00.000Z");

/** A brief exercising all four formats with clean, disclosed, non-slop prompts. */
function fullBrief(): CreativeBrief {
  return {
    id: "launch-social-2026-07",
    purpose: "Product Hunt launch — social image + teaser video + soundtrack + narration",
    items: [
      {
        format: "image",
        prompt: "A weekly grocery pantry on a wooden counter in natural window light, top-down.",
        disclosure: "Image created with AI assistance.",
        quality: "pro",
        aspectRatio: "16:9",
      },
      {
        format: "video",
        prompt: "A short pantry-to-plate montage in a calm, homey kitchen.",
        disclosure: "AI-generated video.",
        durationSeconds: 6,
      },
      {
        format: "music",
        prompt: "A warm acoustic bed, upbeat but calm, for a launch teaser.",
        disclosure: "AI-generated music.",
      },
      {
        format: "voiceover",
        prompt: "Read this line in a warm, calm tone about never wasting groceries again.",
        disclosure: "AI-generated voiceover.",
      },
    ],
  };
}

describe("stageCreative — happy batch via an injected provider (keyless)", () => {
  it("stages every format and returns a metadata manifest + raw results", async () => {
    const client = new MediaGenClient(keyedEnv(), allOkProvider());
    const { manifest, results } = await stageCreative(fullBrief(), client, FIXED_NOW);

    expect(manifest.briefId).toBe("launch-social-2026-07");
    expect(manifest.stagedAt).toBe(FIXED_NOW.toISOString());
    expect(manifest.counts).toEqual({ total: 4, ok: 4, rejected: 0, unavailable: 0, error: 0 });
    expect(manifest.items).toHaveLength(4);
    expect(results).toHaveLength(4);

    const [image, video, music, voice] = manifest.items;

    // Image: quality "pro" routes to the pinned pro id; bytes sized; disclosure carried.
    expect(image!.status).toBe("ok");
    expect(image!.format).toBe("image");
    expect(image!.model).toBe(MEDIA_MODELS.imagePro);
    expect(image!.mimeType).toBe("image/png");
    expect(image!.disclosure).toBe("Image created with AI assistance.");
    expect(image!.auditPass).toBe(true);
    expect(typeof image!.bytes).toBe("number");
    expect(image!.bytes!).toBeGreaterThan(0);
    expect(image!.operationName).toBeUndefined();

    // Video: a pending long-running op — operation name, empty mime, no bytes.
    expect(video!.status).toBe("ok");
    expect(video!.format).toBe("video");
    expect(video!.operationName).toBe("operations/vid-123");
    expect(video!.mimeType).toBe("");
    expect(video!.bytes).toBeUndefined();

    // Music routes to the clip Lyria id; voiceover to the TTS id — both carry bytes.
    expect(music!.model).toBe(MEDIA_MODELS.music);
    expect(music!.bytes!).toBeGreaterThan(0);
    expect(voice!.model).toBe(MEDIA_MODELS.voiceover);
    expect(voice!.bytes!).toBeGreaterThan(0);

    // The raw results still carry the payloads for the caller to persist.
    const firstOk = results[0] as Extract<MediaGenResult, { status: "ok" }>;
    expect(firstOk.asset.dataBase64).toBe("SU1BR0VfQllURVM=");
  });

  it("keeps payloads OUT of the reviewable manifest (metadata only)", async () => {
    const client = new MediaGenClient(keyedEnv(), allOkProvider());
    const { manifest } = await stageCreative(fullBrief(), client, FIXED_NOW);
    const json = serializeManifest(manifest);
    // No base64 payload should ever leak into the small review index.
    expect(json).not.toContain("SU1BR0VfQllURVM=");
    expect(json).not.toContain("QVVESU9fQllURVM=");
    // ...but it round-trips as valid JSON.
    expect(JSON.parse(json)).toEqual(manifest);
  });
});

describe("stageCreative — degrade-by-default", () => {
  it("stages a manifest with every item 'unavailable' when no key is configured (no throw)", async () => {
    const client = new MediaGenClient(NO_KEY_ENV);
    const { manifest, results } = await stageCreative(fullBrief(), client, FIXED_NOW);
    expect(manifest.counts).toEqual({ total: 4, ok: 0, rejected: 0, unavailable: 4, error: 0 });
    expect(manifest.items.every((i) => i.status === "unavailable")).toBe(true);
    expect(results.every((r) => r.status === "unavailable")).toBe(true);
  });

  it("rejects an undisclosed/slop item via the audit gate, spending nothing", async () => {
    const client = new MediaGenClient(NO_KEY_ENV);
    const brief: CreativeBrief = {
      id: "bad",
      purpose: "audit gate",
      items: [
        // missing disclosure
        { format: "image", prompt: "A tidy pantry shelf in soft daylight." },
        // slop vocabulary
        { format: "image", prompt: "hyper-realistic 8k octane render, vibrant colors", disclosure: "AI." },
      ],
    };
    const { manifest } = await stageCreative(brief, client, FIXED_NOW);
    expect(manifest.counts.rejected).toBe(2);
    // rejected happens BEFORE the no-key check — the audit gate precedes any spend.
    expect(manifest.items.every((i) => i.status === "rejected")).toBe(true);
    const slop = manifest.items[1]!;
    expect(slop.auditViolations?.some((v) => v.kind === "slop-prompt")).toBe(true);
  });

  it("records a provider error as an 'error' item and continues the batch", async () => {
    const provider = fakeProvider({
      generateImages: async () => {
        throw new Error("provider boom");
      },
      generateContent: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { data: "QQ==", mimeType: "audio/wav" } }] } }],
      }),
    });
    const client = new MediaGenClient(keyedEnv(), provider);
    const brief: CreativeBrief = {
      id: "mixed",
      purpose: "one bad, one good",
      items: [
        { format: "image", prompt: "A pantry shelf in soft daylight.", disclosure: "AI-assisted." },
        { format: "voiceover", prompt: "Read this warmly.", disclosure: "AI-generated voiceover." },
      ],
    };
    const { manifest } = await stageCreative(brief, client, FIXED_NOW);
    expect(manifest.counts).toEqual({ total: 2, ok: 1, rejected: 0, unavailable: 0, error: 1 });
    expect(manifest.items[0]!.status).toBe("error");
    expect(manifest.items[0]!.reason).toContain("provider boom");
    expect(manifest.items[1]!.status).toBe("ok");
  });
});

describe("stageCreative — edges", () => {
  it("handles an empty brief with an all-zero manifest", async () => {
    const client = new MediaGenClient(NO_KEY_ENV);
    const { manifest, results } = await stageCreative(
      { id: "empty", purpose: "nothing to stage", items: [] },
      client,
      FIXED_NOW,
    );
    expect(manifest.counts).toEqual({ total: 0, ok: 0, rejected: 0, unavailable: 0, error: 0 });
    expect(manifest.items).toEqual([]);
    expect(results).toEqual([]);
  });

  it("degrades an off-type brief format (e.g. from JSON) to an error item, never throwing", async () => {
    // A CreativeBrief loaded from config could carry an unrecognized format at runtime, bypassing
    // the compile-time union. It must degrade, not crash the batch.
    const client = new MediaGenClient(NO_KEY_ENV);
    const brief = {
      id: "offtype",
      purpose: "off-type format",
      items: [{ format: "gif", prompt: "x", disclosure: "AI." }],
    } as unknown as CreativeBrief;
    const { manifest } = await stageCreative(brief, client, FIXED_NOW);
    expect(manifest.counts.error).toBe(1);
    expect(manifest.items[0]!.status).toBe("error");
    expect(manifest.items[0]!.reason).toContain("unknown media format: gif");
  });

  it("guards against an unexpected client throw (batch never aborts)", async () => {
    // A stub whose method REJECTS (the real adapter never does) — proves the consumer's own guard.
    const throwingClient = {
      generateImage: () => Promise.reject(new Error("unexpected")),
    } as unknown as MediaGenClient;
    const { manifest } = await stageCreative(
      { id: "guard", purpose: "guard", items: [{ format: "image", prompt: "x", disclosure: "AI." }] },
      throwingClient,
      FIXED_NOW,
    );
    expect(manifest.counts.error).toBe(1);
    expect(manifest.items[0]!.reason).toContain("unexpected");
  });
});
