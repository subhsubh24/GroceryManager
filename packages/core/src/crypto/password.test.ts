import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  verifyPasswordConstantTime,
} from "./password.js";

describe("password hashing (scrypt)", () => {
  it("verifies the correct password", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects the wrong password", () => {
    const stored = hashPassword("s3cret");
    expect(verifyPassword("not-it", stored)).toBe(false);
  });

  it("stores a salt:hex format and never the plaintext", () => {
    const stored = hashPassword("plaintextpw");
    expect(stored).not.toContain("plaintextpw");
    const [salt, key] = stored.split(":");
    expect(salt).toMatch(/^[0-9a-f]+$/);
    expect(key).toMatch(/^[0-9a-f]+$/);
  });

  it("uses a fresh salt each time (same input → different hash)", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("rejects a malformed stored value instead of throwing", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "no-colon")).toBe(false);
    expect(verifyPassword("x", ":")).toBe(false);
  });
});

describe("verifyPasswordConstantTime (anti username-enumeration)", () => {
  it("verifies a correct password against a real stored hash", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(
      verifyPasswordConstantTime("correct horse battery staple", stored),
    ).toBe(true);
  });

  it("rejects a wrong password against a real stored hash", () => {
    const stored = hashPassword("s3cret");
    expect(verifyPasswordConstantTime("not-it", stored)).toBe(false);
  });

  it("returns false (never throws) when there is no stored hash — the no-user path", () => {
    // null/undefined/empty model an unknown username or a Google-only account with no password.
    // The point of the helper is that this path still runs scrypt (constant cost) rather than
    // short-circuiting; behaviourally it must simply be a safe false.
    expect(verifyPasswordConstantTime("anything", null)).toBe(false);
    expect(verifyPasswordConstantTime("anything", undefined)).toBe(false);
    expect(verifyPasswordConstantTime("anything", "")).toBe(false);
  });

  it("returns false on a malformed stored hash instead of throwing", () => {
    expect(verifyPasswordConstantTime("x", "no-colon")).toBe(false);
    expect(verifyPasswordConstantTime("x", ":")).toBe(false);
  });
});
