/**
 * Media STAGING consumer (GTM_STANDARD §11) — the marketing loop's batch driver on top of the thin
 * {@link MediaGenClient} adapter. Where the adapter generates ONE asset, the staging consumer takes a
 * {@link CreativeBrief} (the set of creative one launch beat needs) and turns it into a reviewable
 * {@link StagingManifest} plus the raw generated assets, so the §13 approval gate has something
 * concrete to review BEFORE anything publishes.
 *
 * Design mirrors the adapter's contract exactly — nothing here changes the trust model:
 *   - DEGRADE, NEVER THROW: the adapter already returns `unavailable` with no key and `error` on any
 *     failure/timeout; the consumer additionally guards each call so one bad item can never abort the
 *     whole batch. Staging a brief always resolves with a manifest, even when every item degraded.
 *   - AUDIT-FIRST stays load-bearing: the adapter runs `auditMediaAsset` BEFORE any paid call, so a
 *     slop/undisclosed spec is `rejected` (its violations surfaced in the manifest) spending nothing.
 *   - STAGES ONLY: this produces + indexes creative for review. Publishing stays gated (Track H / §13)
 *     — the consumer never posts to a channel.
 *
 * The manifest is metadata-only (no base64 payloads) so it is small, reviewable, and safe to persist
 * as a staging index; the raw {@link MediaGenResult}s (which carry the bytes / video operation handle)
 * are returned alongside for the caller to write to storage at the owner-gated edge.
 */
import { getMediaGenClient, MediaGenClient, type MediaGenResult } from "./media-gen.js";
import type { ImageRequest, VideoRequest, AudioRequest } from "./media-gen.js";
import type { MediaFormat } from "./models.js";
import type { MediaAuditViolation } from "./audit.js";

/**
 * One asset to stage. A discriminated union over {@link MediaFormat} so each item carries exactly the
 * request fields its format supports (image aspect/quality, video duration, music full-track). Every
 * variant inherits the audit inputs (`prompt`, optional `caption`, `disclosure`) from the adapter's
 * request types, so the pre-publish audit applies uniformly.
 */
export type CreativeItemSpec =
  | ({ format: "image" } & ImageRequest)
  | ({ format: "video" } & VideoRequest)
  | ({ format: "music" } & AudioRequest)
  | ({ format: "voiceover" } & AudioRequest);

/**
 * A marketing brief: the batch of creative one campaign/launch beat needs. Pure data — it can be
 * authored deterministically from the brand kit + launch plan and reviewed before anything generates.
 */
export interface CreativeBrief {
  /** Stable id for this brief (e.g. "launch-day-social-2026-07"). Names the staging manifest. */
  id: string;
  /** Human purpose, for the §13 reviewer (e.g. "Product Hunt launch — social + email header"). */
  purpose: string;
  /** The assets to stage, in priority order. */
  items: CreativeItemSpec[];
}

/** Per-item outcome in a {@link StagingManifest} — a review summary, deliberately WITHOUT the payload. */
export interface StagedItem {
  format: MediaFormat;
  status: MediaGenResult["status"];
  /** The pinned preview model id that produced (or is producing) the asset. */
  model?: string;
  /** IANA MIME type of the produced asset. Empty string for a still-pending video operation. */
  mimeType?: string;
  /** Whether the pre-publish audit passed (present for ok + rejected). */
  auditPass?: boolean;
  /** The audit violations that caused a `rejected` outcome (empty/absent otherwise). */
  auditViolations?: MediaAuditViolation[];
  /** The FTC AI-assisted disclosure shipped with an `ok` asset. */
  disclosure?: string;
  /** Approximate decoded payload size in bytes (image/music/voiceover). Absent for pending video. */
  bytes?: number;
  /** VIDEO only: the long-running operation handle to poll for the finished asset. */
  operationName?: string;
  /** Reason string for a non-terminal outcome (`unavailable` / `error`). */
  reason?: string;
}

/** Tally of item outcomes — the at-a-glance staging health for the reviewer. */
export interface StagingCounts {
  total: number;
  ok: number;
  rejected: number;
  unavailable: number;
  error: number;
}

/** The reviewable staging index for one brief (metadata only — no payloads). */
export interface StagingManifest {
  briefId: string;
  purpose: string;
  /** ISO-8601 timestamp the brief was staged. */
  stagedAt: string;
  counts: StagingCounts;
  items: StagedItem[];
}

/** The full result of staging a brief: the reviewable manifest + the raw results (which carry bytes). */
export interface StagingResult {
  manifest: StagingManifest;
  /** Raw adapter results, index-aligned with `brief.items`, for the caller to persist payloads. */
  results: MediaGenResult[];
}

/** Approximate decoded byte length of a base64 string (payload sizing for the manifest). */
function approxBytesFromBase64(b64: string): number {
  const len = b64.length;
  if (len === 0) return 0;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
}

/** Dispatch a spec to the adapter method for its format. */
function generateForSpec(client: MediaGenClient, spec: CreativeItemSpec): Promise<MediaGenResult> {
  switch (spec.format) {
    case "image":
      return client.generateImage(spec);
    case "video":
      return client.generateVideo(spec);
    case "music":
      return client.generateMusic(spec);
    case "voiceover":
      return client.generateVoiceover(spec);
    default: {
      // Exhaustive at the type level, but a brief authored from JSON/config (which the module doc
      // anticipates) can carry an unrecognized format at runtime. Degrade to an `error` result so the
      // batch never aborts — upholding the never-throw contract even for an off-type brief.
      const bad = spec as { format?: unknown };
      return Promise.resolve<MediaGenResult>({
        status: "error",
        reason: `unknown media format: ${String(bad.format)}`,
      });
    }
  }
}

/** Map a raw adapter result to the metadata-only review summary. */
function toStagedItem(format: MediaFormat, result: MediaGenResult): StagedItem {
  switch (result.status) {
    case "ok":
      return {
        format,
        status: "ok",
        model: result.asset.model,
        mimeType: result.asset.mimeType,
        auditPass: result.audit.pass,
        disclosure: result.asset.disclosure,
        ...(result.asset.dataBase64 !== undefined
          ? { bytes: approxBytesFromBase64(result.asset.dataBase64) }
          : {}),
        ...(result.asset.operationName !== undefined
          ? { operationName: result.asset.operationName }
          : {}),
      };
    case "rejected":
      return {
        format,
        status: "rejected",
        auditPass: result.audit.pass,
        auditViolations: result.audit.violations,
      };
    case "unavailable":
      return { format, status: "unavailable", reason: result.reason };
    case "error":
      return { format, status: "error", reason: result.reason };
  }
}

/** Tally item outcomes for the manifest header. */
function tally(items: StagedItem[]): StagingCounts {
  const counts: StagingCounts = {
    total: items.length,
    ok: 0,
    rejected: 0,
    unavailable: 0,
    error: 0,
  };
  for (const item of items) counts[item.status] += 1;
  return counts;
}

/**
 * Stage a creative brief: run each item through the media adapter, collect the reviewable manifest and
 * the raw results. Sequential + bounded (each call is wall-clock capped inside the adapter) for
 * predictable cost. NEVER throws — a brief with no Gemini key resolves with every item `unavailable`;
 * an item that unexpectedly throws is recorded as `error` and the batch continues.
 *
 * @param brief   the assets to stage.
 * @param client  the media adapter (defaults to the shared singleton; inject a fake in tests).
 * @param now     staging timestamp (injectable for deterministic tests).
 */
export async function stageCreative(
  brief: CreativeBrief,
  client: MediaGenClient = getMediaGenClient(),
  now: Date = new Date(),
): Promise<StagingResult> {
  const results: MediaGenResult[] = [];
  const items: StagedItem[] = [];

  for (const spec of brief.items) {
    let result: MediaGenResult;
    try {
      result = await generateForSpec(client, spec);
    } catch (err) {
      // The adapter is degrade-by-default and shouldn't throw; guard anyway so one bad item never
      // aborts the batch (best-effort, same contract as the adapter itself).
      result = { status: "error", reason: err instanceof Error ? err.message : String(err) };
    }
    results.push(result);
    items.push(toStagedItem(spec.format, result));
  }

  const manifest: StagingManifest = {
    briefId: brief.id,
    purpose: brief.purpose,
    stagedAt: now.toISOString(),
    counts: tally(items),
    items,
  };

  return { manifest, results };
}

/** Serialize a manifest to pretty JSON for persistence as a staging index. */
export function serializeManifest(manifest: StagingManifest): string {
  return JSON.stringify(manifest, null, 2);
}
