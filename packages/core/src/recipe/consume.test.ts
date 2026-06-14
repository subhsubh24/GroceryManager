import { describe, expect, it } from "vitest";
import {
  parseMeasure,
  planConsumption,
  type ConsumeIngredient,
  type ConsumePantryItem,
} from "./consume.js";

describe("parseMeasure", () => {
  it("parses quantity + unit forms", () => {
    expect(parseMeasure("200g")).toEqual({ qty: 200, unit: "g" });
    expect(parseMeasure("1 1/2 cups")).toEqual({ qty: 1.5, unit: "cup" });
    expect(parseMeasure("1/2 tsp")).toEqual({ qty: 0.5, unit: "tsp" });
    expect(parseMeasure("½ cup")).toEqual({ qty: 0.5, unit: "cup" });
    expect(parseMeasure("2")).toEqual({ qty: 2, unit: null });
    expect(parseMeasure("1-2 tbsp")).toEqual({ qty: 1, unit: "tbsp" }); // low end of a range
  });

  it("returns null for non-quantities", () => {
    expect(parseMeasure("to taste")).toBeNull();
    expect(parseMeasure("a pinch")).toBeNull();
    expect(parseMeasure("")).toBeNull();
    expect(parseMeasure(null)).toBeNull();
  });
});

const pantry: ConsumePantryItem[] = [
  { canonicalItemId: "c-chicken", name: "chicken breast", baseQtyOnHand: 500 },
  { canonicalItemId: "c-eggs", name: "eggs", baseQtyOnHand: 12 },
  { canonicalItemId: "c-spinach", name: "spinach", aliases: ["baby spinach"], baseQtyOnHand: 100 },
  { canonicalItemId: "c-salt", name: "salt", baseQtyOnHand: 1000 },
];

// Resolver: grams pass through for mass items; bare numbers count for "each"-style items.
const resolver = (id: string, qty: number, unit: string | null) => {
  if (unit === "g") return qty;
  if (unit === null && id === "c-eggs") return qty; // eggs measured in count
  return null; // cups/tsp/etc. need item-specific conversions — skip in v1
};

describe("planConsumption", () => {
  it("emits precise decrements only for convertible measures, clamped to on-hand", () => {
    const ings: ConsumeIngredient[] = [
      { name: "chicken breast", measure: "300 g" },
      { name: "2 eggs", measure: "2" },
      { name: "fresh baby spinach", measure: "1 cup" }, // matches c-spinach but cup → unresolved
      { name: "salt", measure: "to taste" }, // matched, no quantity
    ];
    const plan = planConsumption(ings, pantry, { resolveBaseQty: resolver });

    expect(plan.deltas).toEqual([
      { canonicalItemId: "c-chicken", name: "chicken breast", baseQtyDelta: -300 },
      { canonicalItemId: "c-eggs", name: "eggs", baseQtyDelta: -2 },
    ]);
    expect(plan.usedUnmeasured.sort()).toEqual(["salt", "spinach"]);
  });

  it("never decrements below zero on-hand", () => {
    const plan = planConsumption(
      [{ name: "spinach", measure: "5000 g" }],
      pantry,
      { resolveBaseQty: resolver },
    );
    expect(plan.deltas[0]!.baseQtyDelta).toBe(-100); // clamped to the 100 on hand
  });

  it("scales by servings", () => {
    const plan = planConsumption(
      [{ name: "chicken breast", measure: "100 g" }],
      pantry,
      { resolveBaseQty: resolver, servingsScale: 2 },
    );
    expect(plan.deltas[0]!.baseQtyDelta).toBe(-200);
  });

  it("skips optional ingredients and unmatched items, de-dupes repeats", () => {
    const plan = planConsumption(
      [
        { name: "truffle oil", measure: "10 g" }, // not in pantry
        { name: "parsley", measure: "1 tbsp", isOptional: true }, // optional
        { name: "chicken breast", measure: "100 g" },
        { name: "diced chicken breast", measure: "100 g" }, // same pantry item again
      ],
      pantry,
      { resolveBaseQty: resolver },
    );
    expect(plan.deltas).toHaveLength(1);
    expect(plan.deltas[0]!.canonicalItemId).toBe("c-chicken");
  });

  it("records matches as used (qty unknown) when no resolver is provided", () => {
    const plan = planConsumption([{ name: "chicken breast", measure: "300 g" }], pantry);
    expect(plan.deltas).toEqual([]);
    expect(plan.usedUnmeasured).toEqual(["chicken breast"]);
  });
});
