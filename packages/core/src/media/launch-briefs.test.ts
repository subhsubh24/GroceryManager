import { describe, expect, it } from "vitest";
import type { Env } from "@gm/config/env";
import { MediaGenClient, type MediaProvider } from "./media-gen.js";
import {
  LAUNCH_CREATIVE_BRIEFS,
  LAUNCH_AI_DISCLOSURE,
  auditLaunchBriefs,
  stageLaunchCreative,
} from "./launch-briefs.js";

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
      candidates: [
        { content: { parts: [{ inlineData: { data: "QVVESU9fQllURVM=", mimeType: "audio/wav" } }] } },
      ],
    }),
  });
}

const FIXED_NOW = new Date("2026-07-13T00:00:00.000Z");

describe("launch-briefs — authoring is well-formed", () => {
  it("authors at least one brief, each with a stable non-empty id + purpose + items", () => {
    expect(LAUNCH_CREATIVE_BRIEFS.length).toBeGreaterThan(0);
    for (const brief of LAUNCH_CREATIVE_BRIEFS) {
      expect(brief.id.trim().length).toBeGreaterThan(0);
      expect(brief.purpose.trim().length).toBeGreaterThan(0);
      expect(brief.items.length).toBeGreaterThan(0);
    }
  });

  it("uses unique brief ids so persisted manifests never collide", () => {
    const ids = LAUNCH_CREATIVE_BRIEFS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ships the FTC AI-assisted disclosure on every item", () => {
    for (const brief of LAUNCH_CREATIVE_BRIEFS) {
      for (const item of brief.items) {
        expect(item.disclosure).toBe(LAUNCH_AI_DISCLOSURE);
      }
    }
  });
});

describe("auditLaunchBriefs — the authored briefs pass the pre-publish gate", () => {
  it("is audit-clean for every item (disclosure present + no slop vocabulary)", () => {
    const { pass, results } = auditLaunchBriefs();
    // Load-bearing: if any authored prompt/caption reached for a slop term or dropped its disclosure,
    // this flips to false — the authoring half is held to the same bar the adapter enforces on spend.
    expect(pass).toBe(true);
    for (const r of results) {
      expect(r.audit.pass, `brief item ${r.key} must be audit-clean`).toBe(true);
      expect(r.audit.violations).toEqual([]);
    }
  });

  it("returns one audit result per authored item", () => {
    const total = LAUNCH_CREATIVE_BRIEFS.reduce((n, b) => n + b.items.length, 0);
    expect(auditLaunchBriefs().results.length).toBe(total);
  });
});

describe("stageLaunchCreative — the batch driver", () => {
  it("degrades to an all-`unavailable` manifest per brief with no key (no network, no throw)", async () => {
    const client = new MediaGenClient(NO_KEY_ENV);
    const staged = await stageLaunchCreative(client, FIXED_NOW);

    expect(staged.length).toBe(LAUNCH_CREATIVE_BRIEFS.length);
    staged.forEach((result, i) => {
      const brief = LAUNCH_CREATIVE_BRIEFS[i]!;
      expect(result.manifest.briefId).toBe(brief.id);
      expect(result.manifest.purpose).toBe(brief.purpose);
      expect(result.manifest.stagedAt).toBe(FIXED_NOW.toISOString());
      expect(result.manifest.counts.total).toBe(brief.items.length);
      expect(result.manifest.counts.unavailable).toBe(brief.items.length);
      expect(result.manifest.counts.ok).toBe(0);
      expect(result.manifest.items.every((it) => it.status === "unavailable")).toBe(true);
    });
  });

  it("stages every item as `ok` when a keyed provider returns valid assets", async () => {
    const client = new MediaGenClient(keyedEnv(), allOkProvider());
    const staged = await stageLaunchCreative(client, FIXED_NOW);

    expect(staged.length).toBe(LAUNCH_CREATIVE_BRIEFS.length);
    staged.forEach((result, i) => {
      const brief = LAUNCH_CREATIVE_BRIEFS[i]!;
      expect(result.manifest.counts.ok).toBe(brief.items.length);
      expect(result.manifest.counts.unavailable).toBe(0);
      expect(result.results.length).toBe(brief.items.length);
      expect(result.results.every((r) => r.status === "ok")).toBe(true);
    });
  });
});
