/**
 * Receipt extraction (PLAN §5.1 step 4 / §5.5).
 *
 * Loop-engineered: a deterministic `cheerio` pre-clean cuts tokens, then a cheap Gemini call
 * runs through `generateWithVerify` — Zod-validated, then checked by the deterministic
 * `verifyReceipt` hook, escalating a tier only on failure. The client is injected so the
 * orchestration is unit-testable with a fake.
 */
import * as cheerio from "cheerio";
import { ReceiptExtraction } from "@gm/shared";
import type { GeminiClient, VerifyResult } from "../llm/client.js";
import { verifyReceipt } from "./verify.js";

const RECEIPT_SYSTEM =
  "You extract grocery/household receipts into structured line items. Use only what's present; " +
  "set unknown fields to null. Prices are integer cents. Do not invent items or totals.";

/** Strip an HTML/EML receipt to compact text the model can cheaply parse. */
export function cleanReceiptText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, head, noscript").remove();
  const rawText = $("body").length ? $("body").text() : $.root().text();
  return rawText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

export function buildExtractionPrompt(cleanedText: string, retailerHint?: string): string {
  const hint = retailerHint ? `\nLikely retailer: ${retailerHint}.` : "";
  return (
    `Extract this receipt into the schema. Return every purchased line item.${hint}\n\n` +
    `--- RECEIPT ---\n${cleanedText}\n--- END ---`
  );
}

export interface ExtractOptions {
  retailerHint?: string;
  maxAttempts?: number;
}

/** Run the full verify-then-escalate extraction. Returns the tier used + attempt count. */
export async function extractReceipt(
  client: GeminiClient,
  cleanedText: string,
  opts: ExtractOptions = {},
): Promise<VerifyResult<ReceiptExtraction>> {
  return client.generateWithVerify({
    schema: ReceiptExtraction,
    prompt: buildExtractionPrompt(cleanedText, opts.retailerHint),
    system: RECEIPT_SYSTEM,
    verify: verifyReceipt,
    tier: "cheap",
    maxAttempts: opts.maxAttempts ?? 3,
    // Prices → cents, line totals, and the grand total are computed by running Python, not predicted
    // (PLAN §8 — deterministic math belongs in code). flash-lite supports the code-exec tool.
    codeExecution: true,
  });
}

/**
 * Same verify-then-escalate extraction, but from a PHOTO of a paper/email receipt instead of cleaned
 * HTML — for shopping somewhere that isn't an Amazon/WFM/Instacart email. The image(s) are passed as
 * vision parts (mirroring detectPantryItems); the prompt + RECEIPT_SYSTEM + verify hook are otherwise
 * identical, and `codeExecution` keeps the cents/totals math deterministic.
 */
export async function extractReceiptImage(
  client: GeminiClient,
  images: import("../llm/client.js").ImagePart[],
  opts: { maxAttempts?: number } = {},
): Promise<VerifyResult<ReceiptExtraction>> {
  return client.generateWithVerify({
    schema: ReceiptExtraction,
    prompt: "Extract every purchased line item from this receipt photo into the schema. Prices are integer cents.",
    system: RECEIPT_SYSTEM,
    verify: verifyReceipt,
    tier: "cheap",
    maxAttempts: opts.maxAttempts ?? 3,
    codeExecution: true,
    images,
  });
}
