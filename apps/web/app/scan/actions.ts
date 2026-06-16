"use server";
import { redirect } from "next/navigation";
import { GEMINI_MODELS } from "@gm/config/constants";
import { getDb, getPantryView, withTenant } from "@gm/db";
import {
  applyVisionScan,
  detectPantryItems,
  reconcileScan,
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
      newItems: ReconciledDetection[];
      unconfirmed: UnconfirmedItem[];
    };

/** Detect items in the uploaded photo(s) and reconcile against the pantry — read-only (no writes). */
export async function analyzeScan(_prev: AnalyzeState, formData: FormData): Promise<AnalyzeState> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return { status: "error", message: "Vision scan needs a Gemini API key configured." };
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

    const detections = await detectPantryItems(images, { location });

    const userId = await currentUserId();
    if (!userId) return { status: "error", message: "No user context." };
    const pantry = await withTenant(getDb(), userId, (tx) => getPantryView(tx, userId));

    const result = reconcileScan(
      detections.map((d) => ({
        rawLabel: d.label,
        presenceConfidence: d.presenceConfidence,
        qtyEstimate: d.qtyEstimate,
        qtyConfidence: d.qtyConfidence,
      })),
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
      model: GEMINI_MODELS.cheap,
      confirmations: result.confirmations,
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
  if (confirmations.length === 0 && newItems.length === 0) return;

  const userId = await currentUserId();
  if (!userId) return;
  await withTenant(getDb(), userId, (tx) =>
    applyVisionScan(tx, userId, { location, model, summary, confirmations, newItems }),
  );
  redirect("/pantry");
}
