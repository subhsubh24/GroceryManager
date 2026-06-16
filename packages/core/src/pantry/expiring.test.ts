import { describe, expect, it } from "vitest";
import { selectExpiringSoon, type PantryRowLike } from "./expiring.js";

const now = new Date("2026-06-13T00:00:00Z");
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();

const rows: PantryRowLike[] = [
  { canonicalItemId: "spinach", name: "Spinach", domain: "grocery", status: "in_stock", estimatedRunOutAt: inDays(2) },
  { canonicalItemId: "milk", name: "Milk", domain: "grocery", status: "expired_likely", estimatedRunOutAt: inDays(-1) },
  { canonicalItemId: "rice", name: "Rice", domain: "grocery", status: "in_stock", estimatedRunOutAt: inDays(40) },
  { canonicalItemId: "oil", name: "Olive oil", domain: "grocery", status: "low", estimatedRunOutAt: null },
  { canonicalItemId: "eggs", name: "Eggs", domain: "grocery", status: "out", estimatedRunOutAt: inDays(-2) },
  { canonicalItemId: "soap", name: "Dish soap", domain: "household", status: "expired_likely", estimatedRunOutAt: null },
];

describe("selectExpiringSoon", () => {
  it("includes expired + soon-to-run-out, excludes far-off, out, and quantity-low", () => {
    const got = selectExpiringSoon(rows, { now, withinDays: 5, domain: "grocery" });
    const ids = got.map((g) => g.canonicalItemId);
    expect(ids).toContain("spinach"); // runs out in 2d
    expect(ids).toContain("milk"); // expired_likely
    expect(ids).not.toContain("rice"); // 40d away
    expect(ids).not.toContain("oil"); // low = quantity, not spoilage, and no run-out date
    expect(ids).not.toContain("eggs"); // out = nothing to use
  });

  it("ranks already-expired first, then soonest run-out", () => {
    const got = selectExpiringSoon(rows, { now, domain: "grocery" });
    expect(got[0]!.canonicalItemId).toBe("milk"); // expired
    expect(got[1]!.canonicalItemId).toBe("spinach");
  });

  it("computes daysLeft and reason", () => {
    const got = selectExpiringSoon(rows, { now, domain: "grocery" });
    const spinach = got.find((g) => g.canonicalItemId === "spinach")!;
    expect(spinach.reason).toBe("runs_out_soon");
    expect(spinach.daysLeft).toBe(2);
    expect(got.find((g) => g.canonicalItemId === "milk")!.reason).toBe("expired_likely");
  });

  it("respects the domain filter", () => {
    const grocery = selectExpiringSoon(rows, { now, domain: "grocery" }).map((g) => g.canonicalItemId);
    expect(grocery).not.toContain("soap");
    const all = selectExpiringSoon(rows, { now }).map((g) => g.canonicalItemId);
    expect(all).toContain("soap");
  });

  it("honors a custom withinDays window", () => {
    const tight = selectExpiringSoon(rows, { now, withinDays: 1, domain: "grocery" }).map((g) => g.canonicalItemId);
    expect(tight).not.toContain("spinach"); // 2d > 1d window
    expect(tight).toContain("milk"); // expired regardless of window
  });
});
