import { describe, expect, it } from "vitest";
import { buildDigest, type DigestInput } from "./build.js";

const base: DigestInput = {
  expiring: [],
  reorderDue: [],
  spentThisWeekCents: 0,
  homeCookedThisWeek: 0,
};

const exp = (name: string) => ({ name, reason: "runs_out_soon", daysLeft: 2 });
const due = (name: string) => ({ name, recommendQty: 1, recommendByDate: null });

describe("buildDigest", () => {
  it("is quiet when nothing needs attention", () => {
    const d = buildDigest(base);
    expect(d.isQuiet).toBe(true);
    expect(d.headline).toMatch(/all quiet/i);
  });

  it("headlines reorder + expiring counts", () => {
    expect(buildDigest({ ...base, reorderDue: [due("milk"), due("eggs")] }).headline).toBe("2 to reorder.");
    expect(buildDigest({ ...base, expiring: [exp("spinach")] }).headline).toBe("1 expiring soon.");
    expect(
      buildDigest({ ...base, reorderDue: [due("milk")], expiring: [exp("spinach"), exp("kale")] }).headline,
    ).toBe("1 to reorder · 2 expiring soon.");
  });

  it("summarizes cooked + spend in the subline", () => {
    expect(buildDigest({ ...base, homeCookedThisWeek: 1, spentThisWeekCents: 1234 }).subline).toBe(
      "You cooked 1 meal this week · $12.34 spent.",
    );
    expect(buildDigest({ ...base, homeCookedThisWeek: 3, spentThisWeekCents: 0 }).subline).toBe(
      "You cooked 3 meals this week · $0.00 spent.",
    );
    expect(buildDigest(base).subline).toBe("No meals logged this week yet · $0.00 spent.");
  });

  it("caps the top lists at 5 while reporting full counts", () => {
    const many = Array.from({ length: 8 }, (_, i) => exp(`item${i}`));
    const d = buildDigest({ ...base, expiring: many });
    expect(d.expiringCount).toBe(8);
    expect(d.topExpiring.length).toBe(5);
    expect(d.topExpiring[0]!.name).toBe("item0"); // preserves input order
  });
});
