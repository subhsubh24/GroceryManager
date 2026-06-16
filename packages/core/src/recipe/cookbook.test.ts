import { describe, expect, it } from "vitest";
import { decodeSaved, dedupeSaved, encodeSaved, isValidShareToken, type SavedRecipe } from "./cookbook.js";

describe("encodeSaved / decodeSaved", () => {
  it("round-trips all four fields", () => {
    const r: SavedRecipe = { id: "52772", title: "Teriyaki Chicken", imageUrl: "http://img/x.jpg", cuisine: "Japanese" };
    expect(decodeSaved(encodeSaved(r))).toEqual(r);
  });

  it("round-trips with optional fields omitted", () => {
    const r: SavedRecipe = { id: "1", title: "Toast" };
    const decoded = decodeSaved(encodeSaved(r));
    expect(decoded).toEqual({ id: "1", title: "Toast", imageUrl: undefined, cuisine: undefined });
  });

  it("rejects junk and non-objects", () => {
    expect(decodeSaved("not json")).toBeNull();
    expect(decodeSaved("")).toBeNull();
    expect(decodeSaved("null")).toBeNull();
    expect(decodeSaved("42")).toBeNull();
    expect(decodeSaved("[1,2,3]")).toBeNull();
  });

  it("rejects missing or empty id/title", () => {
    expect(decodeSaved(JSON.stringify({ title: "No id" }))).toBeNull();
    expect(decodeSaved(JSON.stringify({ id: "1" }))).toBeNull();
    expect(decodeSaved(JSON.stringify({ id: "", title: "Empty id" }))).toBeNull();
    expect(decodeSaved(JSON.stringify({ id: "1", title: "" }))).toBeNull();
    expect(decodeSaved(JSON.stringify({ id: 1, title: "Numeric id" }))).toBeNull();
  });
});

describe("dedupeSaved", () => {
  const v = (id: string, title: string) => JSON.stringify({ id, title });

  it("dedupes by id keeping the most recent occurrence", () => {
    const out = dedupeSaved([
      { value: v("a", "Old title"), occurredAt: new Date("2026-01-01") },
      { value: v("a", "New title"), occurredAt: new Date("2026-02-01") },
    ]);
    expect(out).toEqual([{ id: "a", title: "New title", imageUrl: undefined, cuisine: undefined }]);
  });

  it("sorts newest-first", () => {
    const out = dedupeSaved([
      { value: v("a", "A"), occurredAt: new Date("2026-01-01") },
      { value: v("b", "B"), occurredAt: new Date("2026-03-01") },
      { value: v("c", "C"), occurredAt: new Date("2026-02-01") },
    ]);
    expect(out.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("drops unparseable rows", () => {
    const out = dedupeSaved([
      { value: "garbage", occurredAt: new Date("2026-01-01") },
      { value: v("a", "A"), occurredAt: new Date("2026-02-01") },
      { value: JSON.stringify({ title: "no id" }), occurredAt: new Date("2026-03-01") },
    ]);
    expect(out.map((r) => r.id)).toEqual(["a"]);
  });

  it("returns [] for no rows", () => {
    expect(dedupeSaved([])).toEqual([]);
  });
});

describe("isValidShareToken", () => {
  it("accepts url-safe base64url tokens of 16–64 chars", () => {
    expect(isValidShareToken("abcdEFGH12345678")).toBe(true); // exactly 16
    expect(isValidShareToken("a-_Zb9".padEnd(24, "x"))).toBe(true); // includes - and _
    expect(isValidShareToken("k".repeat(64))).toBe(true); // exactly 64
    // The real minting path: randomBytes(18).toString("base64url") → ~24 url-safe chars.
    expect(isValidShareToken("Zm9vYmFyYmF6cXV4MTIzNDU2")).toBe(true);
  });

  it("rejects too-short or empty tokens", () => {
    expect(isValidShareToken("")).toBe(false);
    expect(isValidShareToken("short")).toBe(false);
    expect(isValidShareToken("a".repeat(15))).toBe(false); // one under the floor
  });

  it("rejects tokens over 64 chars", () => {
    expect(isValidShareToken("a".repeat(65))).toBe(false);
  });

  it("rejects path, whitespace, SQL, and percent chars", () => {
    expect(isValidShareToken("abcdEFGH12345678/")).toBe(false); // slash (path)
    expect(isValidShareToken("abcd EFGH 12345678")).toBe(false); // spaces
    expect(isValidShareToken("abcdEFGH123456%20")).toBe(false); // percent-encoding
    expect(isValidShareToken("' OR 1=1 --aaaaaaaa")).toBe(false); // SQL-ish
    expect(isValidShareToken("abcdEFGH1234567+")).toBe(false); // non-url-safe base64 char
    expect(isValidShareToken("abcdEFGH12345678\n")).toBe(false); // trailing newline
  });
});
