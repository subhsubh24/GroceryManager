/**
 * Recipe import parsing (PLAN §10 "Recipe import (URL or photo)"). Cheap-first + pure:
 * most recipe sites embed schema.org `Recipe` JSON-LD, so we extract that deterministically (free,
 * reliable) and only fall back to the model (see import-llm.ts) for pages without it. Server-only
 * (uses cheerio) — kept out of the @gm/core/recipe barrel so client bundles stay clean.
 */
import * as cheerio from "cheerio";
import { z } from "zod";
import type { ProviderRecipe } from "./provider.js";

/** An imported recipe maps onto the same shape the rest of the app uses (so Cook Mode + matching
 * reuse it), plus an optional human servings/yield string. */
export interface ImportedRecipe extends ProviderRecipe {
  servings?: string | null;
}

/** LLM output shape for the fallback path (pages with no JSON-LD / pasted text). */
export const RecipeImportFields = z.object({
  title: z.string(),
  servings: z.string().nullable(),
  ingredients: z.array(z.object({ name: z.string(), measure: z.string().nullable() })),
  instructions: z.array(z.string()),
});
export type RecipeImportFields = z.infer<typeof RecipeImportFields>;

type Json = Record<string, unknown>;

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function typeMatches(node: Json, type: string): boolean {
  const t = node["@type"];
  const eq = (x: unknown) => typeof x === "string" && x.toLowerCase() === type.toLowerCase();
  return Array.isArray(t) ? t.some(eq) : eq(t);
}

/** Flatten an arbitrary JSON-LD payload (object, array, or `@graph` container) into candidate nodes. */
function collectNodes(parsed: unknown, out: Json[]): void {
  if (Array.isArray(parsed)) {
    for (const x of parsed) collectNodes(x, out);
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Json;
    out.push(obj);
    if (Array.isArray(obj["@graph"])) collectNodes(obj["@graph"], out);
  }
}

function firstString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = firstString(x);
      if (s) return s;
    }
  }
  return undefined;
}

/** image can be a URL string, an array, or an ImageObject `{ url }` (or arrays thereof). */
function pickImageUrl(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = pickImageUrl(x);
      if (s) return s;
    }
    return undefined;
  }
  if (v && typeof v === "object" && typeof (v as Json).url === "string") return (v as Json).url as string;
  return undefined;
}

/** recipeInstructions can be a string, an array of strings, HowToStep `{ text }`, or nested
 * HowToSection `{ itemListElement }`. Normalize to newline-joined steps for splitSteps(). */
function instructionsToText(v: unknown): string {
  if (typeof v === "string") return v;
  if (!Array.isArray(v)) return "";
  const steps: string[] = [];
  for (const x of v) {
    if (typeof x === "string") {
      if (x.trim()) steps.push(x.trim());
    } else if (x && typeof x === "object") {
      const obj = x as Json;
      if (Array.isArray(obj.itemListElement)) {
        const sub = instructionsToText(obj.itemListElement);
        if (sub) steps.push(sub);
      } else {
        const t = firstString(obj.text) ?? firstString(obj.name) ?? "";
        if (t.trim()) steps.push(t.trim());
      }
    }
  }
  return steps.join("\n");
}

function yieldToServings(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    const s = v.find((x) => typeof x === "string" || typeof x === "number");
    return s != null ? String(s) : null;
  }
  return null;
}

/** Deterministically extract a recipe from a page's schema.org JSON-LD. Returns null when absent. */
export function extractRecipeJsonLd(html: string, sourceUrl?: string): ImportedRecipe | null {
  const $ = cheerio.load(html);
  const nodes: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      collectNodes(JSON.parse(raw), nodes);
    } catch {
      // Some sites emit invalid or concatenated JSON in a block — skip it, try the others.
    }
  });

  const recipe = nodes.find((n) => typeMatches(n, "Recipe"));
  if (!recipe) return null;
  const title = firstString(recipe.name)?.trim();
  if (!title) return null;

  const ingredients = asArray(recipe.recipeIngredient ?? recipe.ingredients)
    .map((x) => {
      if (typeof x === "string") return x.trim();
      if (x && typeof x === "object") return (firstString((x as Json).name) ?? firstString((x as Json).text) ?? "").trim();
      return "";
    })
    .filter((s) => s.length > 0)
    .map((line) => ({ name: line }));

  const instructions = instructionsToText(recipe.recipeInstructions);

  return {
    id: "import", // not persisted in v1 — rendered inline
    title,
    imageUrl: pickImageUrl(recipe.image),
    sourceUrl,
    instructions: instructions || undefined,
    ingredients,
    servings: yieldToServings(recipe.recipeYield),
  };
}

/** Strip a page to compact text for the model fallback (drops nav/scripts/boilerplate). */
export function recipeHtmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, head, noscript, nav, footer, header, form, svg, iframe").remove();
  const text = $("body").length ? $("body").text() : $.root().text();
  return text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const IMPORT_FIELD_RULES =
  "Use only what's present; if there's no servings/yield, set servings to null. For each ingredient " +
  "give the food name plus its measure (amount + unit) when stated, else measure null. instructions: " +
  "an ordered array of step strings.";

export function buildImportPrompt(text: string): string {
  return (
    `Extract this single recipe into the schema. ${IMPORT_FIELD_RULES}\n\n` +
    `--- RECIPE ---\n${text}\n--- END ---`
  );
}

export function buildImportImagePrompt(): string {
  return (
    "Read the single recipe shown in the attached photo (a cookbook page or screenshot) and extract " +
    `it into the schema. ${IMPORT_FIELD_RULES}`
  );
}

const LEADING_QTY = /^\s*(?:\d+\s+\d+\/\d+|\d+\s*[½⅓⅔¼¾⅛⅜⅝⅞]|\d+\/\d+|[½⅓⅔¼¾⅛⅜⅝⅞]|\d+(?:[.,]\d+)?)\s*/;
const LEADING_UNIT =
  /^(?:lbs?|pounds?|oz|ounces?|kgs?|g|grams?|cups?|tbsps?|tsps?|tablespoons?|teaspoons?|cloves?|cans?|bottles?|bunch(?:es)?|sticks?|heads?|slices?|mls?|l|liters?|litres?|packs?|packets?|jars?|bags?|boxes?|pinch(?:es)?|dash(?:es)?|sprigs?|handful)\b\.?\s*/i;

/**
 * Pure: reduce a recipe ingredient line to a food name for matching / list-add — drop prep after a
 * comma ("garlic, sliced" → "garlic") and a leading quantity + unit ("3 cloves garlic" → "garlic").
 * Best-effort: leaves anything it doesn't recognize intact (trigram matching is forgiving downstream).
 */
export function cleanIngredientName(line: string): string {
  let s = (line.split(",")[0] ?? "").trim();
  const qty = LEADING_QTY.exec(s);
  if (qty) {
    s = s.slice(qty[0].length).trimStart();
    // A unit word only counts as a unit when it FOLLOWED a quantity ("3 cloves garlic" → "garlic").
    // Don't strip a leading word from an unquantified name ("gram flour", "cans of tomatoes", "g").
    s = s.replace(/^\([^)]*\)\s*/, "").trimStart(); // e.g. "2 (14.5 oz) cans diced tomatoes" → after qty strip → "(14.5 oz) cans diced tomatoes"
    s = s.replace(LEADING_UNIT, "").trimStart();
    s = s.replace(/^\([^)]*\)\s*/, "").trimStart(); // e.g. "1/2 cup (120ml) milk" → after unit strip → "(120ml) milk"
  }
  return s.trim();
}

/**
 * SSRF guard for the URL-import path: only http(s) to a public host. Blocks loopback, link-local,
 * private ranges, and cloud-metadata endpoints (the client `type="url"` input is trivially bypassed
 * via a direct POST, so this must be enforced server-side). DNS-rebinding is out of scope for now.
 */
export function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    return false;
  }
  if (/^(?:127|10|0)\./.test(host)) return false; // loopback / private / unspecified
  if (/^192\.168\./.test(host)) return false;
  if (/^169\.254\./.test(host)) return false; // link-local incl. cloud metadata 169.254.169.254
  if (/^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (host === "[::1]" || host === "::1") return false; // IPv6 loopback
  if (host.startsWith("[fe80") || host.startsWith("[fc") || host.startsWith("[fd")) return false;
  // IPv4-mapped IPv6 (::ffff:x.x.x.x): Node's URL parser normalizes these to all-hex form
  // (e.g. ::ffff:127.0.0.1 → [::ffff:7f00:1]), so the IPv4 range checks above never fire.
  if (host.startsWith("[::ffff:")) return false;
  return true;
}

/** Pure: map validated LLM fields → an ImportedRecipe (steps joined for splitSteps, blanks dropped). */
export function fieldsToImportedRecipe(f: RecipeImportFields, sourceUrl?: string): ImportedRecipe {
  return {
    id: "import",
    title: f.title.trim(),
    sourceUrl,
    servings: f.servings,
    instructions:
      f.instructions
        .map((s) => s.trim())
        .filter(Boolean)
        .join("\n") || undefined,
    ingredients: f.ingredients
      .map((i) => ({ name: i.name.trim(), measure: i.measure?.trim() || undefined }))
      .filter((i) => i.name.length > 0),
  };
}
