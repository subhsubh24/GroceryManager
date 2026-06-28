import { describe, it, expect } from "vitest";
import { isUuid } from "./uuid.js";

describe("isUuid", () => {
  it("accepts canonical UUIDs (any version, either case)", () => {
    for (const v of [
      "f22837b4-7f7b-45d9-b074-6347842200d0",
      "06FF276A-6099-42C4-BB83-E127670311F6",
      "00000000-0000-0000-0000-000000000000",
    ]) {
      expect(isUuid(v)).toBe(true);
    }
  });

  it("rejects the stale-session id that crashed the dashboard", () => {
    expect(isUuid("user-1")).toBe(false);
  });

  it("rejects other non-UUID strings + non-strings", () => {
    for (const v of [
      "",
      "user-123",
      "not-a-uuid",
      "f22837b4-7f7b-45d9-b074-6347842200d", // too short
      "f22837b4-7f7b-45d9-b074-6347842200d0x", // trailing junk
      " f22837b4-7f7b-45d9-b074-6347842200d0", // leading space
      undefined,
      null,
      42,
      {},
    ]) {
      expect(isUuid(v)).toBe(false);
    }
  });
});
