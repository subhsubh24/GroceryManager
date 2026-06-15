/**
 * Recipe import orchestration (PLAN §10). Server-only (network: fetch + Gemini) — exposed via the
 * "@gm/core/recipe/import-llm" subpath, never the recipe barrel, so client bundles stay clean.
 *
 * Cheap-first: for a URL, parse schema.org JSON-LD deterministically and only call the model when a
 * page has none; pasted text always goes to the model. Deps are injected so it's testable offline.
 */
import type { GeminiClient } from "../llm/client.js";
import { getGeminiClient } from "../llm/index.js";
import {
  RecipeImportFields,
  buildImportPrompt,
  extractRecipeJsonLd,
  fieldsToImportedRecipe,
  recipeHtmlToText,
  type ImportedRecipe,
} from "./import.js";

const IMPORT_SYSTEM =
  "You convert a single recipe (from a web page or pasted text) into structured fields. " +
  "Use only what's present; never invent ingredients or steps. Keep amounts as written.";

export interface ImportRecipeDeps {
  client?: GeminiClient;
  fetchImpl?: typeof fetch;
}

export interface ImportRecipeResult {
  recipe: ImportedRecipe;
  method: "json-ld" | "llm";
}

async function llmImport(client: GeminiClient, text: string, sourceUrl?: string): Promise<ImportedRecipe> {
  const fields = await client.generateStructured(RecipeImportFields, buildImportPrompt(text), {
    tier: "cheap",
    system: IMPORT_SYSTEM,
  });
  return fieldsToImportedRecipe(fields, sourceUrl);
}

export async function importRecipe(
  input: { url?: string; text?: string },
  deps: ImportRecipeDeps = {},
): Promise<ImportRecipeResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = input.url?.trim();
  const text = input.text?.trim();

  if (url) {
    const res = await fetchImpl(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GroceryManager/1.0; +recipe-import)",
        Accept: "text/html",
      },
    });
    if (!res.ok) throw new Error(`Couldn't fetch the page (${res.status}).`);
    const html = await res.text();
    const jsonLd = extractRecipeJsonLd(html, url);
    if (jsonLd && jsonLd.ingredients.length > 0) return { recipe: jsonLd, method: "json-ld" };
    // No usable JSON-LD → fall back to the model over the cleaned page text.
    const client = deps.client ?? getGeminiClient();
    return { recipe: await llmImport(client, recipeHtmlToText(html), url), method: "llm" };
  }

  if (text) {
    const client = deps.client ?? getGeminiClient();
    return { recipe: await llmImport(client, text), method: "llm" };
  }

  throw new Error("Provide a recipe URL or paste the recipe text.");
}
