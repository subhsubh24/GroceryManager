"use server";
import { redirect } from "next/navigation";
import { loadEnv } from "@gm/config/env";
import { getDb, getPantryView, loadPreferenceSignals, withTenant } from "@gm/db";
import { isPremium } from "@gm/core/billing";
import { checkLlmQuota } from "@/app/api/_lib/llm-quota";
import {
  applyVisionScan,
  DEFAULT_SCAN_TIER,
  detectPantryItems,
  isSemanticMethod,
  reconcileScan,
  resolveScanLabels,
  scanModelFor,
  type PossibleMatch,
  type ReconciledDetection,
  type ScanLocation,
  type UnconfirmedItem,
} from "@gm/core/vision";
import { currentUserId } from "@/app/lib/tenant";

export type AnalyzeState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      location: ScanLocation;
      summary: string;
      model: string;
      confirmations: ReconciledDetection[];
      possibleMatches: PossibleMatch[];
      newItems: ReconciledDetection[];
      unconfirmed: UnconfirmedItem[];
    };

/** Detect items in the uploaded photo(s) and reconcile against the pantry — read-only (no writes). */
export async function analyzeScan(_prev: AnalyzeState, formData: FormData): Promise<AnalyzeState> {
  try {
    const env = loadEnv();
    if (!env.GEMINI_API_KEY && !env.GOOGLE_VERTEX_PROJECT) {
      return { status: "error", message: "Vision scan requires Gemini or Google Vertex AI configured." };
    }
    const location = (String(formData.get("location") || "fridge")) as ScanLocation;
    const files = formData
      .getAll("photos")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { status: "error", message: "Add at least one photo." };

    const images = await Promise.all(
      files.slice(0, 4).map(async (f) => ({
        mimeType: f.type || "image/jpeg",
        dataBase64: Buffer.from(await f.arrayBuffer()).toString("base64"),
      })),
    );

    const userId = await currentUserId();
    if (!userId) return { status: "error", message: "No user context." };

    const signals = await withTenant(getDb(), userId, (tx) => loadPreferenceSignals(tx, userId));
    const quota = checkLlmQuota(userId, isPremium(signals));
    if (!quota.allowed) {
      return { status: "error", message: "Daily AI limit reached — upgrade for more." };
    }

    // The vision call is the slow part; the pantry read is independent of it, so run them together.
    const [detections, pantry] = await Promise.all([
      detectPantryItems(images, { location }),
      withTenant(getDb(), userId, (tx) => getPantryView(tx, userId)),
    ]);
    const pantryIds = new Set(pantry.map((p) => p.canonicalItemId));

    // Semantic pre-resolution: map each detected label → an existing canonical via the cascade, so a
    // cross-wording match ("pop" → tracked "soda") is caught even with no shared word. A confident
    // (deterministic) hit becomes a definite match; a SEMANTIC (embedding/LLM) hit to a pantry item
    // becomes a softMatch → reconcile asks "is this your X?" rather than auto-confirming.
    const resolved = await resolveScanLabels(userId, detections.map((d) => d.label));

    const result = reconcileScan(
      detections.map((d) => {
        const r = resolved.get(d.label);
        const id = r?.canonicalItemId ?? null;
        const semanticInPantry = id != null && pantryIds.has(id) && isSemanticMethod(r!.method);
        return {
          rawLabel: d.label,
          presenceConfidence: d.presenceConfidence,
          qtyEstimate: d.qtyEstimate,
          qtyConfidence: d.qtyConfidence,
          // Definite match (deterministic in-pantry, or a non-pantry catalog id to reuse) vs. a
          // semantic in-pantry candidate to ask about.
          canonicalItemId: semanticInPantry ? null : id,
          softMatchId: semanticInPantry ? id : null,
        };
      }),
      pantry.map((p) => ({
        canonicalItemId: p.canonicalItemId,
        name: p.name,
        aliases: p.aliases,
        status: p.status,
        confidence: p.confidence,
      })),
    );

    return {
      status: "ready",
      location,
      summary: result.summary,
      model: scanModelFor(DEFAULT_SCAN_TIER),
      confirmations: result.confirmations,
      possibleMatches: result.possibleMatches,
      newItems: result.newItems,
      unconfirmed: result.unconfirmed,
    };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Apply the user-approved confirmations + additions, then return to the pantry. */
export async function applyScan(formData: FormData): Promise<void> {
  const location = (String(formData.get("location") || "fridge")) as ScanLocation;
  const summary = String(formData.get("summary") || "");
  const model = String(formData.get("model") || "") || null;
  const parse = (key: string): ReconciledDetection[] =>
    formData
      .getAll(key)
      .map((v) => {
        try {
          return JSON.parse(String(v)) as ReconciledDetection;
        } catch {
          return null;
        }
      })
      .filter((x): x is ReconciledDetection => x != null);

  const confirmations = parse("confirm");
  const newItems = parse("add");

  // Possible-match decisions: each "pmchoice-<i>" radio submits a ReconciledDetection — either a
  // confirm_present (user said "same as the one I have", so no duplicate) or a new_item ("add as
  // new"). Route each by its action into the right bucket.
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("pmchoice-")) continue;
    try {
      const d = JSON.parse(String(v)) as ReconciledDetection;
      (d.action === "confirm_present" ? confirmations : newItems).push(d);
    } catch {
      /* skip a malformed choice */
    }
  }

  if (confirmations.length === 0 && newItems.length === 0) return;

  const userId = await currentUserId();
  if (!userId) return;
  await withTenant(getDb(), userId, (tx) =>
    applyVisionScan(tx, userId, { location, model, summary, confirmations, newItems }),
  );
  redirect("/pantry");
}
