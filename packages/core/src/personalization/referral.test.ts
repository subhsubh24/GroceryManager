import { describe, expect, it } from "vitest";
import { countJoined, isValidReferralCode } from "./referral.js";

describe("isValidReferralCode", () => {
  it("accepts url-safe base64url codes of 8–64 chars", () => {
    expect(isValidReferralCode("abcd1234")).toBe(true); // exactly 8
    expect(isValidReferralCode("aB3-_xYz9012")).toBe(true); // ~12 like a minted code
    expect(isValidReferralCode("A_-".padEnd(64, "x"))).toBe(true); // exactly 64
  });

  it("rejects too-short, too-long, empty, or junk/injection input", () => {
    expect(isValidReferralCode("")).toBe(false);
    expect(isValidReferralCode("short7x")).toBe(false); // 7 chars
    expect(isValidReferralCode("x".repeat(65))).toBe(false); // 65 chars
    expect(isValidReferralCode("has spaces!!")).toBe(false);
    expect(isValidReferralCode("with/slash00")).toBe(false);
    expect(isValidReferralCode("with%percent")).toBe(false);
    expect(isValidReferralCode('"quote"value')).toBe(false);
    expect(isValidReferralCode("a=b&c=d12345")).toBe(false);
  });
});

describe("countJoined", () => {
  it("counts distinct ids (dedupes)", () => {
    expect(countJoined(["u1", "u2", "u3"])).toBe(3);
    expect(countJoined(["u1", "u1", "u2"])).toBe(2);
    expect(countJoined(["u1", "u1", "u1"])).toBe(1);
  });

  it("ignores empty/whitespace ids and handles the empty list", () => {
    expect(countJoined([])).toBe(0);
    expect(countJoined(["", "  ", "u1"])).toBe(1);
    expect(countJoined(["", ""])).toBe(0);
  });
});
