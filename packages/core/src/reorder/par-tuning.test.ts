import { describe, expect, it } from "vitest";
import { tuneParForWaste } from "./par-tuning.js";

describe("tuneParForWaste", () => {
  it("lowers target par and reorder point by the step factor", () => {
    const t = tuneParForWaste({ targetParQty: 8, reorderPointQty: 4 });
    expect(t).toEqual({ targetParQty: 6, reorderPointQty: 3 }); // ×0.75
  });

  it("compounds when applied repeatedly (learns to buy progressively less)", () => {
    let par = { targetParQty: 8 as number | null, reorderPointQty: 4 as number | null };
    for (let i = 0; i < 3; i++) {
      const t = tuneParForWaste(par);
      if (t) par = t;
    }
    expect(par.targetParQty).toBeLessThan(4); // 8 → 6 → 4.5 → 3.375
  });

  it("floors at minPar so it never drives the item to zero", () => {
    expect(tuneParForWaste({ targetParQty: 1.2, reorderPointQty: 0.5 }, { minPar: 1 })).toEqual({
      targetParQty: 1,
      reorderPointQty: 0.375,
    });
    // already at/under the floor → nothing to lower
    expect(tuneParForWaste({ targetParQty: 1, reorderPointQty: 1 }, { minPar: 1 })).toBeNull();
  });

  it("keeps the reorder point at or below the new par", () => {
    const t = tuneParForWaste({ targetParQty: 4, reorderPointQty: 10 })!;
    expect(t.reorderPointQty).toBeLessThanOrEqual(t.targetParQty);
  });

  it("defaults the reorder point from par when unset", () => {
    const t = tuneParForWaste({ targetParQty: 8, reorderPointQty: null })!;
    expect(t.targetParQty).toBe(6);
    expect(t.reorderPointQty).toBe(3); // (8×0.5)×0.75
  });

  it("returns null when there is no par to tune", () => {
    expect(tuneParForWaste({ targetParQty: null, reorderPointQty: null })).toBeNull();
  });
});
