import { describe, expect, it } from "vitest";
import { assessOrderReadiness } from "./order-readiness.js";

const now = new Date("2026-06-23T00:00:00Z");
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe("assessOrderReadiness", () => {
  it("is clear when there's nothing actionable", () => {
    const r = assessOrderReadiness({ reorderCount: 0, dueDates: [], listCount: 0, now });
    expect(r.state).toBe("clear");
  });

  it("is building for a small, non-urgent list", () => {
    const r = assessOrderReadiness({ reorderCount: 1, dueDates: [inDays(20)], listCount: 1, now });
    expect(r.state).toBe("building");
    expect(r.count).toBe(2);
  });

  it("is ready once the list reaches a worthwhile size (no urgency)", () => {
    const r = assessOrderReadiness({ reorderCount: 3, dueDates: [inDays(15), inDays(20)], listCount: 2, now });
    expect(r.state).toBe("ready");
    expect(r.headline).toBe("Ready to order");
    expect(r.count).toBe(5);
  });

  it("is urgent when something runs out within the window — even if the list is small", () => {
    const r = assessOrderReadiness({ reorderCount: 1, dueDates: [inDays(1)], listCount: 0, now });
    expect(r.state).toBe("urgent");
    expect(r.headline).toBe("Time to order");
    expect(r.urgentCount).toBe(1);
  });

  it("urgency wins over a merely-ready size", () => {
    const r = assessOrderReadiness({
      reorderCount: 6,
      dueDates: [inDays(0), inDays(10), inDays(12)],
      listCount: 0,
      now,
    });
    expect(r.state).toBe("urgent");
    expect(r.urgentCount).toBe(1);
  });

  it("pluralizes the urgent reason when more than one item runs out soon", () => {
    const r = assessOrderReadiness({ reorderCount: 2, dueDates: [inDays(1), inDays(2)], listCount: 0, now });
    expect(r.state).toBe("urgent");
    expect(r.urgentCount).toBe(2);
    // guards the plural branch of `${n} ${n === 1 ? "item runs" : "items run"} out ...`
    expect(r.reason).toBe("2 items run out in the next few days.");
  });

  it("uses the singular reason when the building list has exactly one item", () => {
    const r = assessOrderReadiness({ reorderCount: 1, dueDates: [inDays(20)], listCount: 0, now });
    expect(r.state).toBe("building");
    expect(r.count).toBe(1);
    // guards the singular branch of `${n} ${n === 1 ? "item" : "items"} so far ...`
    expect(r.reason).toBe("1 item so far — I'll flag it when it's worth ordering.");
  });

  it("ignores far-off and null due dates for urgency", () => {
    const r = assessOrderReadiness({ reorderCount: 2, dueDates: [null, inDays(30)], listCount: 0, now });
    expect(r.urgentCount).toBe(0);
    expect(r.state).toBe("building");
  });

  it("respects a custom ready threshold", () => {
    const r = assessOrderReadiness({ reorderCount: 3, dueDates: [], listCount: 0, now, readyThreshold: 3 });
    expect(r.state).toBe("ready");
  });
});
