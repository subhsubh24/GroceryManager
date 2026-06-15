import { describe, expect, it } from "vitest";
import { buildDigestNotification } from "./notify.js";
import type { DigestSummary } from "../digest/build.js";

const base: DigestSummary = {
  headline: "2 to reorder · 1 expiring soon.",
  subline: "You cooked 3 meals this week · $42.00 spent.",
  expiringCount: 1,
  reorderCount: 2,
  spentThisWeekCents: 4200,
  homeCookedThisWeek: 3,
  topExpiring: [],
  topReorder: [],
  isQuiet: false,
};

describe("buildDigestNotification", () => {
  it("maps headline/subline → a notification pointing at the digest", () => {
    expect(buildDigestNotification(base)).toEqual({
      title: "2 to reorder · 1 expiring soon.",
      body: "You cooked 3 meals this week · $42.00 spent.",
      url: "/digest",
    });
  });

  it("returns null on a quiet week (don't nag)", () => {
    expect(buildDigestNotification({ ...base, isQuiet: true })).toBeNull();
  });
});
