import { z } from "zod";

/** Shared string-literal enums. DB columns and LLM schemas both derive from these. */

export const Domain = z.enum(["grocery", "household", "personal_care"]);
export type Domain = z.infer<typeof Domain>;

export const UnitDimension = z.enum(["MASS", "VOLUME", "COUNT", "DISCRETE"]);
export type UnitDimension = z.infer<typeof UnitDimension>;

export const Retailer = z.enum([
  "amazon",
  "whole_foods",
  "instacart",
  "other",
]);
export type Retailer = z.infer<typeof Retailer>;

export const PurchaseSource = z.enum([
  "gmail_amazon",
  "gmail_wfm",
  "gmail_instacart",
  "amazon_scrape",
  "manual",
  "barcode",
]);
export type PurchaseSource = z.infer<typeof PurchaseSource>;

export const PurchaseStatus = z.enum(["parsed", "needs_review", "confirmed"]);
export type PurchaseStatus = z.infer<typeof PurchaseStatus>;

export const MatchMethod = z.enum([
  "override",
  "upc",
  "trigram",
  "embedding",
  "llm",
  "manual",
]);
export type MatchMethod = z.infer<typeof MatchMethod>;

export const StockStatus = z.enum([
  "in_stock",
  "low",
  "out",
  "expired_likely",
]);
export type StockStatus = z.infer<typeof StockStatus>;

export const LedgerEventType = z.enum([
  "purchase",
  "consume_recipe",
  "consume_inferred",
  "vision_confirmed",
  "manual_adjust",
  "spoilage",
  "correction",
  "open",
]);
export type LedgerEventType = z.infer<typeof LedgerEventType>;

export const CleanupLoad = z.enum(["low", "med", "high"]);
export type CleanupLoad = z.infer<typeof CleanupLoad>;

export const PreferencePolarity = z.enum(["positive", "negative", "neutral"]);
export type PreferencePolarity = z.infer<typeof PreferencePolarity>;

export const PreferenceSource = z.enum([
  "onboarding_q",
  "meal_log",
  "skip",
  "reorder",
  "waste",
  "rating",
  "chat",
  "correction",
]);
export type PreferenceSource = z.infer<typeof PreferenceSource>;

/** Energy/effort level for "how much do you feel like cooking tonight?" (PLAN §7.4). */
export const EnergyLevel = z.enum([
  "cook_nice",
  "keep_it_easy",
  "zero_effort",
  "eating_out",
]);
export type EnergyLevel = z.infer<typeof EnergyLevel>;
