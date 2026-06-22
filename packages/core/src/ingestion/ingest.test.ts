import { describe, expect, it } from "vitest";
import { coercePurchasedAt } from "./ingest.js";

describe("coercePurchasedAt", () => {
  const now = new Date("2026-06-22T12:00:00.000Z");

  it("keeps a valid ISO date", () => {
    expect(coercePurchasedAt("2026-06-10T17:00:00Z", now).toISOString()).toBe(
      "2026-06-10T17:00:00.000Z",
    );
  });

  it("falls back to now on a malformed date string", () => {
    expect(coercePurchasedAt("not-a-date", now)).toBe(now);
    expect(coercePurchasedAt("2026-13-45", now)).toBe(now);
  });

  it("falls back to now on null / undefined / empty", () => {
    expect(coercePurchasedAt(null, now)).toBe(now);
    expect(coercePurchasedAt(undefined, now)).toBe(now);
    expect(coercePurchasedAt("", now)).toBe(now);
  });

  it("never returns an Invalid Date (the bug it guards)", () => {
    for (const v of ["garbage", "", null, undefined, "2026-99-99"]) {
      expect(Number.isNaN(coercePurchasedAt(v, now).getTime())).toBe(false);
    }
  });
});
