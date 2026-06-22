import { describe, expect, it } from "vitest";
import { isValidUsername, normalizeUsername } from "./username.js";

describe("normalizeUsername", () => {
  it("trims and lowercases", () => {
    expect(normalizeUsername("  JohnDoe  ")).toBe("johndoe");
    expect(normalizeUsername("ALICE_99")).toBe("alice_99");
  });
});

describe("isValidUsername", () => {
  it("accepts well-formed handles", () => {
    for (const u of ["abc", "john_doe", "alice.99", "a1b2c3", "x".repeat(20)]) {
      expect(isValidUsername(u)).toBe(true);
    }
  });

  it("rejects too short / too long", () => {
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("x".repeat(21))).toBe(false);
  });

  it("rejects disallowed characters", () => {
    for (const u of ["john doe", "user@x", "naïve", "a-b", "a+b", "café"]) {
      expect(isValidUsername(u)).toBe(false);
    }
  });

  it("rejects leading/trailing or doubled separators", () => {
    for (const u of [".john", "john.", "_john", "john_", "a..b", "a__b", "a._b"]) {
      expect(isValidUsername(u)).toBe(false);
    }
  });

  it("expects the normalized form (uppercase only passes after normalize)", () => {
    expect(isValidUsername("JohnDoe")).toBe(false);
    expect(isValidUsername(normalizeUsername("JohnDoe"))).toBe(true);
  });
});
