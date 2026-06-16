import { describe, expect, it } from "vitest";
import { estimateBatchFriendly } from "./batch.js";

describe("estimateBatchFriendly", () => {
  it("rates stews/soups/curries as batch-friendly", () => {
    expect(estimateBatchFriendly({ title: "Beef Stew" }).batchFriendly).toBe(true);
    expect(estimateBatchFriendly({ title: "Chicken Curry" }).batchFriendly).toBe(true);
    expect(estimateBatchFriendly({ title: "Lentil Soup" }).batchScore).toBeGreaterThan(0.6);
  });

  it("rates salads / fried / fresh dishes as not batch-friendly", () => {
    expect(estimateBatchFriendly({ title: "Caesar Salad" }).batchFriendly).toBe(false);
    expect(estimateBatchFriendly({ title: "Crispy Fried Chicken" }).batchScore).toBeLessThan(0.5);
  });

  it("uses instructions when the title is neutral", () => {
    const e = estimateBatchFriendly({
      title: "Sunday Dinner",
      instructions: "Braise the meat low and slow; it freezes well for meal prep.",
    });
    expect(e.batchFriendly).toBe(true);
  });

  it("is neutral (~0.5) for an unremarkable dish and explains itself", () => {
    const e = estimateBatchFriendly({ title: "Grilled Cheese Plate" });
    expect(e.batchScore).toBeGreaterThanOrEqual(0.4);
    expect(e.batchScore).toBeLessThanOrEqual(0.6);
    expect(e.reason).toBeTruthy();
  });
});
