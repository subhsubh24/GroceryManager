import { describe, it, expect } from "vitest";
import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  formatInviteCodeForDisplay,
  generateInviteCode,
  isValidInviteCodeFormat,
  normalizeAndValidate,
  normalizeInviteCode,
} from "./invite-code.js";

describe("invite-code — alphabet", () => {
  it("omits the ambiguous glyphs I, L, O, U", () => {
    for (const c of ["I", "L", "O", "U"]) {
      expect(INVITE_CODE_ALPHABET).not.toContain(c);
    }
  });
  it("has exactly 32 symbols (5 bits each, no modulo bias in generate)", () => {
    expect(INVITE_CODE_ALPHABET.length).toBe(32);
    expect(new Set(INVITE_CODE_ALPHABET.split("")).size).toBe(32);
  });
});

describe("normalizeInviteCode", () => {
  it("uppercases and strips spaces/hyphens", () => {
    expect(normalizeInviteCode("2345h-7q9wx")).toBe("2345H7Q9WX");
    expect(normalizeInviteCode("2345H 7Q9WX")).toBe("2345H7Q9WX");
  });
  it("folds look-alike glyphs onto the intended symbol (O→0, I/L→1, U→V)", () => {
    expect(normalizeInviteCode("OILU222222")).toBe("011V222222");
  });
  it("caps output at the code length even for a long paste", () => {
    const norm = normalizeInviteCode("2".repeat(500));
    expect(norm.length).toBe(INVITE_CODE_LENGTH);
  });
  it("drops characters outside the alphabet entirely", () => {
    expect(normalizeInviteCode("23-45-67-89-0X")).toBe("234567890X");
    expect(normalizeInviteCode("@2#3$4%5^6&7*8(9)0X")).toBe("234567890X");
  });
});

describe("isValidInviteCodeFormat", () => {
  it("accepts a canonical code", () => {
    expect(isValidInviteCodeFormat("2345H7Q9WX")).toBe(true);
  });
  it("rejects wrong length", () => {
    expect(isValidInviteCodeFormat("2345H7Q9W")).toBe(false); // 9
    expect(isValidInviteCodeFormat("2345H7Q9WXY")).toBe(false); // 11
    expect(isValidInviteCodeFormat("")).toBe(false);
  });
  it("rejects out-of-alphabet symbols (incl. the omitted I/L/O/U and lowercase)", () => {
    expect(isValidInviteCodeFormat("2345H7Q9WO")).toBe(false); // contains O
    expect(isValidInviteCodeFormat("2345h7q9wx")).toBe(false); // lowercase
    expect(isValidInviteCodeFormat("2345H7Q9W!")).toBe(false);
  });
});

describe("normalizeAndValidate", () => {
  it("returns the canonical code for forgiving input", () => {
    expect(normalizeAndValidate("2345h-7q9wx")).toBe("2345H7Q9WX");
    // "o1l1u23456" → O→0, 1, L→1, 1, U→V, 23456 → folds then validates to a canonical code.
    expect(normalizeAndValidate("o1l1u23456")).toBe("0111V23456");
  });
  it("returns null when the input can't form a full canonical code", () => {
    expect(normalizeAndValidate("2345")).toBeNull();
    expect(normalizeAndValidate("")).toBeNull();
    expect(normalizeAndValidate("!!!!!!!!!!")).toBeNull();
  });
});

describe("formatInviteCodeForDisplay", () => {
  it("groups a canonical code as XXXXX-XXXXX", () => {
    expect(formatInviteCodeForDisplay("2345H7Q9WX")).toBe("2345H-7Q9WX");
  });
  it("round-trips through normalize", () => {
    const display = formatInviteCodeForDisplay("2345H7Q9WX");
    expect(normalizeInviteCode(display)).toBe("2345H7Q9WX");
  });
});

describe("generateInviteCode", () => {
  it("produces a canonical code from the injected byte source", () => {
    // Deterministic stub: cycle 0..255 so we exercise the & 31 masking.
    let n = 0;
    const bytes = (len: number) => Uint8Array.from({ length: len }, () => n++ % 256);
    const code = generateInviteCode(bytes);
    expect(code.length).toBe(INVITE_CODE_LENGTH);
    expect(isValidInviteCodeFormat(code)).toBe(true);
  });
  it("maps each 5-bit value to the matching alphabet symbol", () => {
    const bytes = (len: number) => Uint8Array.from({ length: len }, (_v, i) => i); // 0,1,2,...
    const code = generateInviteCode(bytes);
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      expect(code[i]).toBe(INVITE_CODE_ALPHABET[i & 31]);
    }
  });
  it("is uniform-capable: all-zero bytes yield the first symbol repeated (no bias/rejection hang)", () => {
    const bytes = (len: number) => new Uint8Array(len); // all zero
    const code = generateInviteCode(bytes);
    expect(code).toBe(INVITE_CODE_ALPHABET[0]!.repeat(INVITE_CODE_LENGTH));
  });
});
