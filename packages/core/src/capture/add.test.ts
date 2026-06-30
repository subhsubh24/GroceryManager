/**
 * Unit tests for captureToList (PLAN §10 — quick-capture / barcode add → the active shopping list).
 * The orchestration shipped at ~5% coverage: its only exercise lived in the semantic-layer
 * integration path, never in CI. captureToList owns one real decision — reuse an existing canonical
 * when the trigram match clears NORMALIZE.trigramThreshold, else mint a new one — plus the
 * empty-input short circuit and the reason default. The normalization ports + the active-list helper
 * are mocked at the module boundary; the real NORMALIZE threshold is used so the boundary stays honest.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const shoppingListItems = { _name: "shoppingListItems" };

// Capture each inserted list-item row so a test can assert the chosen canonical + reason.
const insertedRows: Record<string, unknown>[] = [];
function makeDb() {
  return {
    // Keep the table arg so a test can assert the write targets shoppingListItems — a regression that
    // swapped tables must not pass silently.
    insert: vi.fn((_table: unknown) => ({
      values: vi.fn(async (row: Record<string, unknown>) => {
        insertedRows.push(row);
      }),
    })),
  };
}

// --- module boundary mocks -------------------------------------------------
const trigramCandidates =
  vi.fn<(name: string, limit: number) => Promise<{ id: string; score: number }[]>>();
const createCanonical = vi.fn<(name: string) => Promise<string>>(async (n) => `new:${n}`);
// Typed two-arg signature mirrors the real getOrCreateActiveList(db, userId) so a dropped arg is caught.
const getOrCreateActiveList = vi.fn<(db: unknown, userId: string) => Promise<string>>(
  async () => "list-1",
);

vi.mock("../ingestion/db-ports.js", () => ({
  createDbNormalizationPorts: () => ({ trigramCandidates, createCanonical }),
}));
vi.mock("@gm/db", () => ({
  getOrCreateActiveList: (db: unknown, userId: string) => getOrCreateActiveList(db, userId),
  shoppingListItems,
}));

const { captureToList } = await import("./add.js");

afterEach(() => {
  vi.clearAllMocks();
  insertedRows.length = 0;
});

describe("captureToList", () => {
  it("short-circuits on an empty item list (no list lookup, no writes)", async () => {
    const db = makeDb();
    const res = await captureToList(db as never, "u", []);

    expect(res).toEqual({ listId: null, added: 0 });
    expect(getOrCreateActiveList).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("reuses an existing canonical when the top trigram match clears the threshold", async () => {
    trigramCandidates.mockResolvedValue([{ id: "spinach", score: 0.9 }]); // ≥ 0.55
    const db = makeDb();

    const res = await captureToList(db as never, "u", [{ name: "baby spinach" }]);

    expect(createCanonical).not.toHaveBeenCalled(); // matched → no new canonical minted
    expect(db.insert).toHaveBeenCalledWith(shoppingListItems); // write targets the right table
    expect(getOrCreateActiveList).toHaveBeenCalledWith(db, "u"); // db + userId forwarded
    expect(insertedRows[0]).toMatchObject({
      shoppingListId: "list-1",
      canonicalItemId: "spinach",
      reason: "manual", // default reason
    });
    expect(res).toEqual({ listId: "list-1", added: 1 });
  });

  it("mints a new canonical when the best match is below the threshold", async () => {
    trigramCandidates.mockResolvedValue([{ id: "weak", score: 0.3 }]); // < 0.55
    const db = makeDb();

    await captureToList(db as never, "u", [{ name: "dragonfruit" }]);

    expect(createCanonical).toHaveBeenCalledWith("dragonfruit");
    expect(insertedRows[0]!.canonicalItemId).toBe("new:dragonfruit");
  });

  it("mints a new canonical when there is no trigram candidate at all", async () => {
    trigramCandidates.mockResolvedValue([]);
    const db = makeDb();

    await captureToList(db as never, "u", [{ name: "yuzu" }]);

    expect(createCanonical).toHaveBeenCalledWith("yuzu");
    expect(insertedRows[0]!.canonicalItemId).toBe("new:yuzu");
  });

  it("honors a caller-supplied reason and counts every added row", async () => {
    trigramCandidates
      .mockResolvedValueOnce([{ id: "tomato", score: 0.8 }])
      .mockResolvedValueOnce([]); // second item misses → created
    const db = makeDb();

    const res = await captureToList(
      db as never,
      "u",
      [{ name: "tomatoes" }, { name: "exotic thing" }],
      { reason: "recipe_need" },
    );

    expect(res.added).toBe(2);
    expect(insertedRows).toHaveLength(2);
    expect(insertedRows.every((r) => r.reason === "recipe_need")).toBe(true);
    expect(insertedRows[0]!.canonicalItemId).toBe("tomato");
    expect(insertedRows[1]!.canonicalItemId).toBe("new:exotic thing");
  });
});
