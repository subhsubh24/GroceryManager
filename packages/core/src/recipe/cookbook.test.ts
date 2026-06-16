import { describe, expect, it } from "vitest";
import { decodeSaved, dedupeSaved, encodeSaved, type SavedRecipe } from "./cookbook.js";

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
