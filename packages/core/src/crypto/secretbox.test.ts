import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generateKeyBase64 } from "./secretbox.js";

describe("secretbox (AES-256-GCM)", () => {
  const key = generateKeyBase64();

  it("round-trips a secret", () => {
    const secret = "ya29.a0AfH-refresh-token-value";
    const enc = encryptSecret(secret, key);
    expect(enc).not.toContain(secret);
    expect(decryptSecret(enc, key)).toBe(secret);
  });

  it("fails to decrypt with the wrong key", () => {
    const enc = encryptSecret("hello", key);
    expect(() => decryptSecret(enc, generateKeyBase64())).toThrow();
  });

  it("fails on tampered ciphertext (auth tag)", () => {
    const enc = encryptSecret("hello", key);
    const bytes = Buffer.from(enc, "base64");
    const last = bytes.length - 1;
    bytes[last] = (bytes[last] ?? 0) ^ 0x01;
    expect(() => decryptSecret(bytes.toString("base64"), key)).toThrow();
  });

  it("rejects a non-32-byte key", () => {
    expect(() => encryptSecret("x", Buffer.from("short").toString("base64"))).toThrow();
  });
});
