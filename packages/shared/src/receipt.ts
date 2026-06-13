import { z } from "zod";
import { Retailer } from "./enums.js";

/**
 * ReceiptExtraction — the schema-guaranteed shape Gemini returns for a cleaned receipt
 * (PLAN §5.5). Drives `responseSchema`; we always re-validate the model output with this.
 *
 * Keep it flat and simple: Gemini structured output supports objects/arrays/enums but not
 * oneOf/anyOf or string/number constraints — so validation/bounds live here in code.
 */
export const ReceiptLineItem = z.object({
  rawText: z.string(), // verbatim line from the receipt
  name: z.string(), // cleaned product name
  brand: z.string().nullable(),
  upc: z.string().nullable(),
  quantity: z.number().nullable(),
  unitText: z.string().nullable(), // e.g. "lb", "oz", "ct", "each"
  packageSize: z.string().nullable(), // e.g. "32 fl oz", "12 ct"
  unitPriceCents: z.number().int().nullable(),
  lineTotalCents: z.number().int().nullable(),
  confidence: z.number().min(0).max(1), // model self-rated
});
export type ReceiptLineItem = z.infer<typeof ReceiptLineItem>;

export const ReceiptExtraction = z.object({
  retailer: Retailer,
  externalOrderId: z.string().nullable(),
  purchasedAt: z.string().nullable(), // ISO 8601
  currency: z.string().default("USD"),
  totalCents: z.number().int().nullable(),
  lineItems: z.array(ReceiptLineItem),
});
export type ReceiptExtraction = z.infer<typeof ReceiptExtraction>;
