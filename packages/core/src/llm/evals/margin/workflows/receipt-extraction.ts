/**
 * Margin cost-per-outcome eval for RECEIPT EXTRACTION (workflow #3) — parse an order email into line
 * items. High-value, high-volume ingestion path; escalating verify loop + code-execution math, so it's
 * one of the pricier per-invocation workflows. Grader is the REAL `scoreReceiptExtraction` (harness) —
 * item recall + retailer + total reconciliation — over the REAL golden fixtures plus hand-authored
 * edges and deterministic fuzz.
 */
import type { EvalScore } from "../../harness.js";
import { scoreReceiptExtraction, type ExpectedReceipt } from "../../harness.js";
import { extractReceipt } from "../../../../ingestion/receipt-parse.js";
import { RECEIPT_FIXTURES } from "../../fixtures.js";
import { syntheticReceipts } from "../fuzz.js";
import type { EvalCase, MarginWorkflowEval } from "./types.js";

export interface ReceiptInput {
  text: string;
  retailerHint?: string;
  expected: ExpectedReceipt;
}

type ReceiptOutput = Awaited<ReturnType<typeof extractReceipt>>["value"];

/** The REAL golden fixtures (sanitized real order emails) — the highest-signal cases. */
const goldenCases: EvalCase<ReceiptInput>[] = RECEIPT_FIXTURES.map((f) => ({
  name: `golden:${f.name}`,
  tags: ["golden", "real"],
  input: { text: f.text, retailerHint: f.retailerHint, expected: f.expected },
}));

/** Hand-authored EDGE cases — the messiness real receipts throw at the extractor. */
const edgeCases: EvalCase<ReceiptInput>[] = [
  {
    name: "edge:single-item",
    tags: ["edge", "minimal"],
    input: {
      retailerHint: "kroger",
      text: ["KROGER — Order Summary", "Whole Milk, 1 GAL                              $3.49", "Total: $3.49"].join("\n"),
      expected: { retailer: "kroger", itemNames: ["milk"], totalCents: 349 },
    },
  },
  {
    name: "edge:noise-and-promos",
    tags: ["edge", "noise"],
    input: {
      retailerHint: "safeway",
      text: [
        "SAFEWAY — Receipt",
        "*** MEMBER SAVINGS APPLIED ***",
        "Bananas, 2.1 LB @ $0.59/LB                     $1.24",
        "Digital coupon: $1.00 OFF                      -$1.00",
        "Rotisserie Chicken                             $6.99",
        "Sparkling Water 12pk                           $4.49",
        "Fuel points earned: 120",
        "Thanks for shopping Safeway!",
      ].join("\n"),
      expected: { retailer: "safeway", itemNames: ["bananas", "chicken", "sparkling water"] },
    },
  },
  {
    name: "edge:unicode-names",
    tags: ["edge", "unicode"],
    input: {
      retailerHint: "trader_joes",
      text: [
        "TRADER JOE'S — Order",
        "Jalapeño Peppers, 6 ct                         $0.99",
        "Açaí Purée Packets, 4 ct                       $4.49",
        "Crème Fraîche, 8 OZ                            $3.29",
        "Total: $8.77",
      ].join("\n"),
      expected: { retailer: "trader_joes", itemNames: ["jalapeno", "acai", "creme fraiche"] },
    },
  },
  {
    name: "edge:refunds-and-replacements",
    tags: ["edge", "refund", "recall-only"],
    input: {
      retailerHint: "instacart",
      text: [
        "Instacart — Your order from Mariano's",
        "Found: Organic Strawberries, 1 LB             $5.99",
        "Replaced: Whole Milk → 2% Milk, 1 GAL         $3.79",
        "Refunded: Out of stock — Fresh Basil          -$2.49",
        "Found: Boneless Chicken Thighs, 1.8 LB        $8.10",
      ].join("\n"),
      expected: { retailer: "instacart", itemNames: ["strawberries", "milk", "chicken thighs"] },
    },
  },
  {
    name: "edge:long-15-items",
    tags: ["edge", "long"],
    input: {
      retailerHint: "whole_foods",
      text: [
        "WHOLE FOODS MARKET — Order Summary",
        ...[
          "Organic Bananas", "Almond Milk 64 OZ", "Sourdough Loaf", "Cage-Free Eggs Dozen", "Baby Carrots 1 LB",
          "Ground Turkey 1 LB", "Cherry Tomatoes Pint", "Hummus 10 OZ", "Baby Kale 5 OZ", "Sharp Cheddar 8 OZ",
          "Penne Pasta 16 OZ", "Marinara Sauce 24 OZ", "Olive Oil 500 ML", "Frozen Blueberries 10 OZ", "Dark Chocolate Bar",
        ].map((n, i) => `${n}${" ".repeat(Math.max(2, 40 - n.length))}$${(2 + i * 0.4).toFixed(2)}`),
      ].join("\n"),
      expected: {
        retailer: "whole_foods",
        itemNames: [
          "bananas", "almond milk", "sourdough", "eggs", "carrots", "turkey", "tomatoes", "hummus",
          "kale", "cheddar", "pasta", "marinara", "olive oil", "blueberries", "chocolate",
        ],
      },
    },
  },
];

/** Deterministic FUZZ — breadth of retailers × item mixes × lengths (recall + retailer graded). */
const fuzzCases: EvalCase<ReceiptInput>[] = syntheticReceipts(12).map((r) => ({
  name: r.name,
  tags: ["fuzz"],
  input: { text: r.text, retailerHint: r.retailerHint, expected: r.expected },
}));

export const receiptExtractionEval: MarginWorkflowEval<ReceiptInput, ReceiptOutput> = {
  workflowId: "grocerymanager-receipt-extraction",
  name: "receipt-extraction",
  spend: "high",
  about: "Parse an order email/HTML into retailer + line items (verify loop + code-exec math).",
  cases: [...goldenCases, ...edgeCases, ...fuzzCases],
  async run(input, client): Promise<ReceiptOutput> {
    const r = await extractReceipt(client, input.text, { retailerHint: input.retailerHint });
    return r.value;
  },
  grade(output, input): EvalScore {
    return scoreReceiptExtraction(output, input.expected);
  },
};
