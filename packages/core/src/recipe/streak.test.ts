import { describe, expect, it } from "vitest";
import { cooksThisWeek, currentStreak, longestStreak, weeklyActivity } from "./streak.js";

// Use explicit UTC instants so day-bucketing is unambiguous regardless of the test machine's TZ.
const d = (s: string) => new Date(s);

describe("currentStreak", () => {
  // Wed 2026-06-17 12:00 UTC — mid-week anchor.
  const now = d("2026-06-17T12:00:00Z");

  it("is 0 with no cooks", () => {
    expect(currentStreak([], now)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const cooks = [
      d("2026-06-15T08:00:00Z"),
      d("2026-06-16T19:00:00Z"),
      d("2026-06-17T07:30:00Z"),
    ];
    expect(currentStreak(cooks, now)).toBe(3);
  });

  it("tolerates an empty today by counting back from yesterday", () => {
    const cooks = [d("2026-06-15T08:00:00Z"), d("2026-06-16T20:00:00Z")];
    expect(currentStreak(cooks, now)).toBe(2);
  });

  it("is 0 when the most recent cook is older than yesterday", () => {
    const cooks = [d("2026-06-14T08:00:00Z"), d("2026-06-15T08:00:00Z")];
    expect(currentStreak(cooks, now)).toBe(0);
  });

  it("breaks the streak on a gap day", () => {
    const cooks = [
      d("2026-06-13T08:00:00Z"), // Sat — separated from the run by the 14th
      d("2026-06-15T08:00:00Z"),
      d("2026-06-16T08:00:00Z"),
      d("2026-06-17T08:00:00Z"),
    ];
    expect(currentStreak(cooks, now)).toBe(3);
  });

  it("dedupes multiple cooks on the same day to one", () => {
    const cooks = [
      d("2026-06-16T08:00:00Z"),
      d("2026-06-16T13:00:00Z"),
      d("2026-06-16T20:00:00Z"),
      d("2026-06-17T09:00:00Z"),
    ];
    expect(currentStreak(cooks, now)).toBe(2);
  });
});

describe("longestStreak", () => {
  it("is 0 with no cooks", () => {
    expect(longestStreak([])).toBe(0);
  });

  it("finds the longest run across gaps and dedupes same-day", () => {
    const cooks = [
      // 2-day run
      d("2026-05-01T08:00:00Z"),
      d("2026-05-02T08:00:00Z"),
      // gap, then a 4-day run (with a same-day dupe that must not inflate it)
      d("2026-05-10T08:00:00Z"),
      d("2026-05-11T08:00:00Z"),
      d("2026-05-11T22:00:00Z"),
      d("2026-05-12T08:00:00Z"),
      d("2026-05-13T08:00:00Z"),
      // isolated day
      d("2026-05-20T08:00:00Z"),
    ];
    expect(longestStreak(cooks)).toBe(4);
  });

  it("is 1 for a single cook", () => {
    expect(longestStreak([d("2026-06-01T08:00:00Z")])).toBe(1);
  });
});

describe("cooksThisWeek", () => {
  // Wed 2026-06-17 12:00 UTC. The week (Mon-start) runs Mon 2026-06-15 00:00 → Mon 2026-06-22 00:00.
  const now = d("2026-06-17T12:00:00Z");

  it("counts cooks within the current Monday-start week (raw, not deduped)", () => {
    const cooks = [
      d("2026-06-15T00:00:00Z"), // Mon 00:00 — inclusive lower boundary
      d("2026-06-16T10:00:00Z"),
      d("2026-06-16T20:00:00Z"), // second cook same day still counts
      d("2026-06-17T09:00:00Z"),
    ];
    expect(cooksThisWeek(cooks, now)).toBe(4);
  });

  it("excludes the prior week and the next week (boundary)", () => {
    const cooks = [
      d("2026-06-14T23:59:59Z"), // Sun 23:59 — last instant of the PRIOR week
      d("2026-06-15T00:00:00Z"), // Mon 00:00 — first instant of THIS week
      d("2026-06-22T00:00:00Z"), // Mon 00:00 — first instant of NEXT week (excluded)
    ];
    expect(cooksThisWeek(cooks, now)).toBe(1);
  });

  it("treats a Monday 00:00 UTC `now` as the start of its own week", () => {
    const mondayNow = d("2026-06-15T00:00:00Z");
    const cooks = [
      d("2026-06-15T00:00:00Z"), // included
      d("2026-06-14T12:00:00Z"), // prior week, excluded
    ];
    expect(cooksThisWeek(cooks, mondayNow)).toBe(1);
  });
});

describe("weeklyActivity", () => {
  const now = d("2026-06-17T12:00:00Z"); // week of Mon 2026-06-15

  it("returns exactly `weeks` buckets, oldest → newest", () => {
    const out = weeklyActivity([], now, 8);
    expect(out.length).toBe(8);
    // Oldest first, newest (current week) last.
    expect(out[0]!.weekStart).toBe("2026-04-27");
    expect(out[7]!.weekStart).toBe("2026-06-15");
    // Buckets are 7 days apart and all zero with no cooks.
    expect(out.every((b) => b.count === 0)).toBe(true);
  });

  it("honors a custom `weeks` count and defaults to 8", () => {
    expect(weeklyActivity([], now, 4).length).toBe(4);
    expect(weeklyActivity([], now).length).toBe(8);
  });

  it("buckets cooks into the correct Monday-start week and drops out-of-window cooks", () => {
    const cooks = [
      d("2026-06-15T08:00:00Z"), // current week
      d("2026-06-17T08:00:00Z"), // current week (2 total)
      d("2026-06-08T08:00:00Z"), // previous week (Mon 2026-06-08)
      d("2026-01-01T08:00:00Z"), // far in the past — outside the 8-week window, ignored
    ];
    const out = weeklyActivity(cooks, now, 8);
    const byStart = Object.fromEntries(out.map((b) => [b.weekStart, b.count]));
    expect(byStart["2026-06-15"]).toBe(2);
    expect(byStart["2026-06-08"]).toBe(1);
    // Total counted equals only the in-window cooks (3 of 4).
    expect(out.reduce((s, b) => s + b.count, 0)).toBe(3);
  });
});
