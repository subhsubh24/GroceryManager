"use server";
import { loadEnv } from "@gm/config/env";
import { getDb, loadPreferenceSignals, withTenant } from "@gm/db";
import { GeminiClient, createGeminiEmbedder } from "@gm/core/llm";
import { createLlmShelfLifeEstimator } from "@gm/core/pantry";
import {
  createDbNormalizationPorts,
  createLlmNormalizer,
  extractReceiptImage,
  ingestReceipt,
} from "@gm/core/ingestion";
import { isPremium } from "@gm/core/billing";
import { currentUserId } from "@/app/lib/tenant";
import { checkLlmQuota } from "@/app/api/_lib/llm-quota";

/**
 * Snap-a-receipt flow (PART of §5.5, but from an IMAGE rather than a Gmail email) — for shopping
 * somewhere that isn't an Amazon/WFM/Instacart receipt email. We extract AND ingest in one action and
 * return a friendly summary; there's no two-step confirm like the vision scan because a receipt is the
 * source of truth (the §5.4 cascade + Review inbox already catch anything low-confidence).
 *
 * Ingest is best-effort: any failure (no key, quota, DB) is mapped to a calm message — we never throw
 * to the client. Source is "manual" with no Gmail message id, so there's no email dedup (re-uploading
 * the same photo adds it again — paper receipts have no stable id to key on).
 */
export type AnalyzeReceiptState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; message: string; addedCount: number; needsReview: number };

const plural = (n: number) => (n === 1 ? "" : "s");

// Cap each uploaded image before we buffer it into memory + base64-inflate it (~+33%) for Gemini.
// Matches the 6 MB guard on the manual import path; a large upload would otherwise pin serverless heap.
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

/** Map a raw ingest/LLM error to a calm, actionable line — quota is the common one (free-tier keys). */
function friendlyError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("exceeded your current quota") || r.includes("resource_exhausted") || r.includes("429")) {
    return "The AI is rate-limited right now — your Gemini key is out of quota. Add billing to your key (pennies per receipt) or try again later.";
  }
  if (r.includes("not signed in")) return "You're signed out — sign in again, then retry.";
  return "Couldn't read that receipt. Give it a moment and try again with a clear, well-lit photo.";
}

/** Extract line items from the uploaded photo(s) and ingest them into the pantry in one pass. */
export async function analyzeAndIngestReceipt(
  _prev: AnalyzeReceiptState,
  formData: FormData,
): Promise<AnalyzeReceiptState> {
  const env = loadEnv();
  if (!env.GEMINI_API_KEY && !env.GOOGLE_VERTEX_PROJECT) {
    return { status: "error", message: "Receipt scanning requires Gemini or Google Vertex AI configured." };
  }

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { status: "error", message: "Add at least one photo of your receipt." };
  if (files.some((f) => f.size > MAX_UPLOAD_BYTES)) {
    return { status: "error", message: "That image is too large — keep each photo under ~6 MB." };
  }

  const userId = await currentUserId();
  if (!userId) return { status: "error", message: "You're signed out — sign in again, then retry." };

  let signals: Awaited<ReturnType<typeof loadPreferenceSignals>>;
  try {
    signals = await withTenant(getDb(), userId, (tx) => loadPreferenceSignals(tx, userId));
  } catch (e) {
    // Same G3 hygiene as the ingest try/catch below: a transient DB blip on the quota gate must
    // degrade to an inline error, never throw to the page-level error boundary.
    console.error("[add-receipt] loadPreferenceSignals failed:", e);
    return { status: "error", message: "Something went wrong. Please try again in a moment." };
  }
  const quota = checkLlmQuota(userId, isPremium(signals));
  if (!quota.allowed) {
    return { status: "error", message: "Daily AI limit reached — upgrade for more." };
  }

  try {
    const images = await Promise.all(
      files.slice(0, 4).map(async (f) => ({
        mimeType: f.type || "image/jpeg",
        dataBase64: Buffer.from(await f.arrayBuffer()).toString("base64"),
      })),
    );

    const client = new GeminiClient(env);
    const result = await withTenant(getDb(), userId, (tx) =>
      ingestReceipt(
        {
          db: tx,
          // Full §5.4 cascade (trigram → embedding → LLM tiebreak/create), same as the Gmail path.
          ports: createDbNormalizationPorts(tx, userId, {
            embed: createGeminiEmbedder(client),
            llm: createLlmNormalizer(client),
            shelfLife: createLlmShelfLifeEstimator(client),
          }),
          extract: async () => (await extractReceiptImage(client, images)).value,
        },
        // "manual" source, no Gmail id → no email dedup (paper receipts have no stable id).
        { userId, source: "manual", gmailMessageId: null, cleanedText: "" },
      ),
    );

    if (result.linesIngested === 0) {
      return {
        status: "error",
        message: "Couldn't read any items — try a clearer, well-lit photo of the full receipt.",
      };
    }

    const reviewNote =
      result.needsReview > 0
        ? ` ${result.needsReview} need${plural(result.needsReview)} a quick review.`
        : "";
    return {
      status: "ready",
      message: `Added ${result.linesIngested} item${plural(result.linesIngested)} from your receipt.${reviewNote}`,
      addedCount: result.linesIngested,
      needsReview: result.needsReview,
    };
  } catch (e) {
    return { status: "error", message: friendlyError(e instanceof Error ? e.message : String(e)) };
  }
}
