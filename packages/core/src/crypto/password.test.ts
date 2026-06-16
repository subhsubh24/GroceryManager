import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

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
