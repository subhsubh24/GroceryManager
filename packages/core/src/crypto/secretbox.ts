/**
 * Authenticated secret encryption for OAuth tokens / cookies at rest (PLAN §11).
 * AES-256-GCM; output is base64(iv[12] | tag[16] | ciphertext). The data key is passed in
 * (envelope-encrypt it with a KMS key in production). Never log plaintext or keys.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const IV_LEN = 12;
const TAG_LEN = 16;

function loadKey(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) throw new Error("encryption key must be 32 bytes (base64-encoded)");
  return key;
}

export function encryptSecret(plaintext: string, keyB64: string): string {
  const key = loadKey(keyB64);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(payloadB64: string, keyB64: string): string {
  const key = loadKey(keyB64);
  const buf = Buffer.from(payloadB64, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

/** Generate a fresh 32-byte data key (base64) — for `TOKEN_ENC_KEY` in dev. */
export function generateKeyBase64(): string {
  return randomBytes(32).toString("base64");
}
