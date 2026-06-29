import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDueItems, publishItem, type ContentItem } from "./scheduler.js";

function item(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "c1",
    channel: "x",
    title: "Title",
    content: "Body",
    scheduledAt: new Date("2026-01-01T00:00:00Z"),
    status: "scheduled",
    ...overrides,
  };
}

describe("getDueItems", () => {
  const now = new Date("2026-06-29T12:00:00Z");

  it("includes scheduled items whose time has passed", () => {
    const due = item({ id: "past", scheduledAt: new Date("2026-06-29T11:59:00Z") });
    expect(getDueItems([due], now)).toEqual([due]);
  });

  it("includes an item scheduled for exactly now (<= boundary)", () => {
    const due = item({ id: "now", scheduledAt: now });
    expect(getDueItems([due], now)).toEqual([due]);
  });

  it("excludes scheduled items still in the future", () => {
    const future = item({ id: "future", scheduledAt: new Date("2026-06-29T12:00:01Z") });
    expect(getDueItems([future], now)).toEqual([]);
  });

  it("excludes non-scheduled statuses even when the time has passed", () => {
    const past = new Date("2026-06-29T11:00:00Z");
    const items: ContentItem[] = [
      item({ id: "draft", status: "draft", scheduledAt: past }),
      item({ id: "published", status: "published", scheduledAt: past }),
      item({ id: "skipped", status: "skipped", scheduledAt: past }),
    ];
    expect(getDueItems(items, now)).toEqual([]);
  });

  it("returns only the due subset from a mixed list", () => {
    const a = item({ id: "a", scheduledAt: new Date("2026-06-29T10:00:00Z") });
    const b = item({ id: "b", scheduledAt: new Date("2026-06-30T10:00:00Z") });
    const c = item({ id: "c", status: "draft", scheduledAt: new Date("2026-06-29T10:00:00Z") });
    expect(getDueItems([a, b, c], now)).toEqual([a]);
  });
});

describe("publishItem — hard channel guardrail", () => {
  // Strip every channel credential so owned-channel attempts skip (no creds) instead of hitting the
  // network, and so the guardrail decision can never depend on ambient env.
  const CREDS = ["X_API_KEY", "X_API_SECRET", "BUFFER_ACCESS_TOKEN", "TYPEFULLY_API_KEY"];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of CREDS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of CREDS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  // The whole point of the guardrail: community/forum/social channels are refused at the code level,
  // never posted to. A regression here would auto-post on undisclosed channels (a trust/ToS incident).
  const FORBIDDEN = ["reddit", "discord", "slack", "telegram", "linkedin", "facebook", "instagram", "hackernews"];
  for (const channel of FORBIDDEN) {
    it(`refuses the non-owned channel "${channel}" without posting`, async () => {
      const res = await publishItem(item({ channel }));
      expect(res.published).toBe(false);
      expect(res.skipped).toBe(true);
      expect(res.reason).toContain("channel-not-permitted");
      expect(res.reason).toContain(channel);
    });
  }

  it("refuses an empty / unknown channel", async () => {
    const res = await publishItem(item({ channel: "" }));
    expect(res.published).toBe(false);
    expect(res.reason).toContain("channel-not-permitted");
  });

  it("blocks a community channel even when disguised with casing/whitespace", async () => {
    const res = await publishItem(item({ channel: "  ReDDit " }));
    expect(res.published).toBe(false);
    expect(res.skipped).toBe(true);
    expect(res.reason).toContain("channel-not-permitted");
    // Normalised to lower/trimmed before the reason is built.
    expect(res.reason).toContain("reddit");
  });

  it.each([
    ["x", "no-x-credentials"],
    ["twitter", "no-x-credentials"],
    ["buffer", "no-buffer-token"],
    ["typefully", "no-typefully-key"],
  ])('routes the owned channel "%s" to its publisher (skips cleanly with no creds)', async (channel, reason) => {
    const res = await publishItem(item({ channel }));
    // Owned channel + no credentials configured ⇒ skipped without a network call, never "published".
    expect(res.published).toBe(false);
    expect(res.skipped).toBe(true);
    expect(res.reason).toBe(reason);
  });

  it("accepts an owned channel regardless of casing/whitespace", async () => {
    const res = await publishItem(item({ channel: " X " }));
    expect(res.reason).toBe("no-x-credentials"); // reached the X publisher, not the guardrail
  });
});
