/**
 * Nutrition module (cook-logging with stored macros). Estimates a cooked meal's macros from its
 * ingredients — USDA FoodData Central primary, LLM fallback — and the pure math to combine them.
 *
 * NOTE: estimate.ts pulls in the Gemini client (server-only), so this barrel is server-side; the web
 * app reaches it via the "@gm/core/nutrition" subpath, like @gm/core/recipe/log-cook.
 */
export * from "./types.js";
export * from "./compute.js";
export * from "./fdc.js";
export * from "./estimate.js";
