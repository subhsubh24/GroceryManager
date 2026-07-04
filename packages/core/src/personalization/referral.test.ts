import { describe, expect, it, vi } from "vitest";
import { attributeReferralBestEffort, countJoined, isValidReferralCode } from "./referral.js";

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

describe("attributeReferralBestEffort (FACTORY_STANDARD §32 — issue #370)", () => {
  it("credits the referrer when the code resolves", async () => {
    const resolveReferrer = vi.fn().mockResolvedValue("referrer-1");
    const recordReferral = vi.fn().mockResolvedValue(undefined);
    const res = await attributeReferralBestEffort("aB3-_xYz9012", "new-user", {
      resolveReferrer,
      recordReferral,
    });
    expect(res).toEqual({ attributed: true, referrerUserId: "referrer-1" });
    expect(resolveReferrer).toHaveBeenCalledWith("aB3-_xYz9012");
    expect(recordReferral).toHaveBeenCalledWith("referrer-1", "new-user");
  });

  it("no-ops (and never touches the DB) on absent, blank, or invalid codes", async () => {
    const resolveReferrer = vi.fn();
    const recordReferral = vi.fn();
    const deps = { resolveReferrer, recordReferral };
    expect(await attributeReferralBestEffort(null, "u", deps)).toEqual({ attributed: false, reason: "no-code" });
    expect(await attributeReferralBestEffort(undefined, "u", deps)).toEqual({ attributed: false, reason: "no-code" });
    expect(await attributeReferralBestEffort("   ", "u", deps)).toEqual({ attributed: false, reason: "no-code" });
    expect(await attributeReferralBestEffort("bad code!", "u", deps)).toEqual({
      attributed: false,
      reason: "invalid-code",
    });
    expect(resolveReferrer).not.toHaveBeenCalled();
    expect(recordReferral).not.toHaveBeenCalled();
  });

  it("reports unknown-referrer (and does NOT record) when the code has no owner", async () => {
    const recordReferral = vi.fn();
    const res = await attributeReferralBestEffort("aB3-_xYz9012", "new-user", {
      resolveReferrer: vi.fn().mockResolvedValue(null),
      recordReferral,
    });
    expect(res).toEqual({ attributed: false, reason: "unknown-referrer" });
    expect(recordReferral).not.toHaveBeenCalled();
  });

  // The §32 guarantee: a NON-ESSENTIAL side-effect failing must NEVER throw out of / block signup.
  it("NEVER throws when resolving the referrer fails — returns the error result", async () => {
    const call = attributeReferralBestEffort("aB3-_xYz9012", "new-user", {
      resolveReferrer: vi.fn().mockRejectedValue(new Error("DB down")),
      recordReferral: vi.fn(),
    });
    await expect(call).resolves.toEqual({ attributed: false, reason: "error" });
  });

  it("NEVER throws when recording the credit fails — returns the error result", async () => {
    const call = attributeReferralBestEffort("aB3-_xYz9012", "new-user", {
      resolveReferrer: vi.fn().mockResolvedValue("referrer-1"),
      recordReferral: vi.fn().mockRejectedValue(new Error("insert failed")),
    });
    await expect(call).resolves.toEqual({ attributed: false, reason: "error" });
  });

  it("NEVER throws even when a dep throws synchronously", async () => {
    const call = attributeReferralBestEffort("aB3-_xYz9012", "new-user", {
      resolveReferrer: () => {
        throw new Error("sync boom");
      },
      recordReferral: vi.fn(),
    });
    await expect(call).resolves.toEqual({ attributed: false, reason: "error" });
  });
});
