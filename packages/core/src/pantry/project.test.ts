import { describe, expect, it } from "vitest";
import { projectPantryStock } from "./project.js";

describe("projectPantryStock", () => {
  it("maps the depletion estimate into a pantry_stock row shape", () => {
    const p = projectPantryStock({
      events: [{ baseQtyDelta: 1000, occurredAt: new Date(2026, 0, 1) }],
      asOf: new Date(2026, 0, 4),
      ratePerDay: 100,
      reorderPointQty: 150,
    });
    expect(p.baseQtyOnHand).toBeCloseTo(700, 6);
    expect(p.status).toBe("in_stock");
    expect(p.estimatedConsumptionRatePerDay).toBe(100);
    expect(p.estimatedRunOutAt).not.toBeNull();
  });
});
