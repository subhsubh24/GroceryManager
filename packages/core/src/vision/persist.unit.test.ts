/**
 * Pure unit tests for applyVisionScan (PLAN §5.6 — "the pantry fills itself" from a reviewed scan).
 *
 * The live `persist.integration.test.ts` proves the same semantics against a real Postgres but is
 * `skipIf(!TEST_DATABASE_URL)`, so it never runs in CI — leaving this core ingestion path at ~0%
 * covered. These tests mock the module boundaries (the ledger writer, the normalization cascade, the
 * AI client builders) and pass a thin Drizzle-shaped fake `db`, so the orchestration logic runs in
 * plain CI with no infra. What we lock here is what applyVisionScan OWNS:
 *   - the §6 ledger-only invariant: every stock mutation goes through appendLedgerAndReproject; the
 *     function NEVER calls db.update on pantry_stock (asserted explicitly);
 *   - the `wasEmpty` re-stock rule: an out/empty item is re-grounded with its estimated qty, an
 *     already-in-stock item is confirmed with a zero delta (rate/confidence decay reset only);
 *   - learned-rate preservation: an existing item's consumption rate is threaded back into the event;
 *   - the new-item cascade: resolve via normalizeLineItem, else createCanonical, then seed via ledger;
 *   - the no-AI-keys degrade: no Gemini client is built and ports get no embedding/LLM deps.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NormalizationResult } from "../ingestion/normalize.js";
import type { ReconciledDetection } from "./reconcile.js";

// --- module boundary mocks -------------------------------------------------
const loadEnv = vi.fn<() => Record<string, string | undefined>>(() => ({}));
vi.mock("@gm/config/env", () => ({ loadEnv: () => loadEnv() }));

const getGeminiClient = vi.fn<() => unknown>(() => ({}));
const createGeminiEmbedder = vi.fn<(ai: unknown) => unknown>(() => ({ embed: vi.fn() }));
vi.mock("../llm/index.js", () => ({
  getGeminiClient: () => getGeminiClient(),
  createGeminiEmbedder: (ai: unknown) => createGeminiEmbedder(ai),
}));

const createLlmNormalizer = vi.fn<(ai: unknown) => unknown>(() => ({ resolve: vi.fn() }));
vi.mock("../ingestion/llm-normalizer.js", () => ({
  createLlmNormalizer: (ai: unknown) => createLlmNormalizer(ai),
}));

const createLlmShelfLifeEstimator = vi.fn<(ai: unknown) => unknown>(() => ({ estimate: vi.fn() }));
vi.mock("../pantry/shelf-life-llm.js", () => ({
  createLlmShelfLifeEstimator: (ai: unknown) => createLlmShelfLifeEstimator(ai),
}));

// ports.createCanonical is the only port applyVisionScan reaches directly (the fallback when a label
// doesn't resolve). normalizeLineItem (mocked below) consumes the rest, so the ports object is opaque.
const createCanonical = vi.fn<(name: string) => Promise<string>>(async () => "canon-created");
const createDbNormalizationPorts = vi.fn<(db: unknown, userId: string, deps: unknown) => unknown>(
  () => ({ createCanonical }),
);
vi.mock("../ingestion/db-ports.js", () => ({
  createDbNormalizationPorts: (db: unknown, userId: string, deps: unknown) =>
    createDbNormalizationPorts(db, userId, deps),
}));

const normalizeLineItem =
  vi.fn<(input: { name: string }, ports: unknown) => Promise<NormalizationResult>>();
vi.mock("../ingestion/normalize.js", () => ({
  normalizeLineItem: (input: { name: string }, ports: unknown) => normalizeLineItem(input, ports),
}));

// The ledger writer is the ONLY sanctioned stock mutation. We spy on every call and assert its args.
const appendLedgerAndReproject = vi.fn<(db: unknown, a: Record<string, unknown>) => Promise<unknown>>(
  async () => ({}),
);
vi.mock("../pantry/persist.js", () => ({
  appendLedgerAndReproject: (db: unknown, a: Record<string, unknown>) =>
    appendLedgerAndReproject(db, a),
}));

// Import AFTER the mocks are registered.
const { applyVisionScan } = await import("./persist.js");

// --- thin Drizzle-shaped fake db ------------------------------------------
type StockRow = { id: string; status: string; qty: string | number; rate: string | number | null };

/**
 * A minimal stand-in for the `Querier`. applyVisionScan issues exactly three shapes:
 *   db.insert(t).values(v).returning(c)  → one row with a fresh id (scan, then each detection)
 *   db.select(c).from(t).where(w)        → the current-stock rows for the confirmation targets
 *   (it NEVER calls db.update — that's the invariant under test)
 * The `update` spy exists only so a regression that adds a direct write is caught loudly.
 */
function makeDb(currentStock: StockRow[]) {
  let insertCount = 0;
  const insert = vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => {
        insertCount += 1;
        // First insert is the pantry_scans header; the rest are scan-detection rows.
        return [{ id: insertCount === 1 ? "scan-1" : `det-${insertCount - 1}` }];
      }),
    })),
  }));
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(async () => currentStock),
    })),
  }));
  const update = vi.fn(() => {
    throw new Error("applyVisionScan must not write pantry_stock directly (ledger-only invariant)");
  });
  return { insert, select, update };
}

function confirm(canonicalItemId: string, qty: number): ReconciledDetection {
  return {
    rawLabel: `label-${canonicalItemId}`,
    action: "confirm_present",
    canonicalItemId,
    matchedName: `label-${canonicalItemId}`,
    presenceConfidence: 0.95,
    qtyEstimate: qty,
    newConfidence: 0.95,
  };
}

function newItem(rawLabel: string, qty: number, canonicalItemId: string | null = null): ReconciledDetection {
  return {
    rawLabel,
    action: "new_item",
    canonicalItemId,
    matchedName: null,
    presenceConfidence: 0.8,
    qtyEstimate: qty,
    newConfidence: 0.8,
  };
}

const baseInput = { location: "pantry" as const, model: null, summary: "test scan" };

afterEach(() => {
  vi.clearAllMocks();
  loadEnv.mockReturnValue({});
  createDbNormalizationPorts.mockReturnValue({ createCanonical });
});

describe("applyVisionScan", () => {
  it("re-stocks an OUT item through the ledger (source=user_confirmed, qty restored, rate preserved) — no direct write", async () => {
    const db = makeDb([{ id: "milk", status: "out", qty: 0, rate: "0.5" }]);

    const res = await applyVisionScan(db as never, "user-1", {
      ...baseInput,
      confirmations: [confirm("milk", 2)],
      newItems: [],
    });

    expect(res).toMatchObject({ scanId: "scan-1", confirmed: 1, added: 0 });
    expect(appendLedgerAndReproject).toHaveBeenCalledTimes(1);
    expect(appendLedgerAndReproject).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        userId: "user-1",
        canonicalItemId: "milk",
        eventType: "vision_confirmed",
        source: "user_confirmed",
        baseQtyDelta: 2, // wasEmpty → restore the estimated qty
        ratePerDay: 0.5, // learned rate carried back into the event, not lost
        confidence: 0.95,
      }),
    );
    // The §6 invariant: the projection is re-grounded SOLELY via the ledger path.
    expect(db.update).not.toHaveBeenCalled();
  });

  it("confirms an already-IN-STOCK item with a ZERO delta (decay reset only, qty unchanged)", async () => {
    const db = makeDb([{ id: "rice", status: "in_stock", qty: "3", rate: null }]);

    await applyVisionScan(db as never, "user-1", {
      ...baseInput,
      confirmations: [confirm("rice", 5)],
      newItems: [],
    });

    expect(appendLedgerAndReproject).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        canonicalItemId: "rice",
        baseQtyDelta: 0, // already present → confirm without inflating quantity
        ratePerDay: null, // no learned rate yet
      }),
    );
  });

  it("treats a confirmation with NO current-stock row as empty (restores estimated qty)", async () => {
    const db = makeDb([]); // confirmation target has no projection row yet

    await applyVisionScan(db as never, "user-1", {
      ...baseInput,
      confirmations: [confirm("beans", 4)],
      newItems: [],
    });

    expect(appendLedgerAndReproject).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ canonicalItemId: "beans", baseQtyDelta: 4 }),
    );
  });

  it("seeds a NEW item that resolves via the normalization cascade through the ledger", async () => {
    const db = makeDb([]);
    normalizeLineItem.mockResolvedValue({
      canonicalItemId: "canon-spinach",
      method: "embedding",
      confidence: 0.9,
      needsReview: false,
    });

    const res = await applyVisionScan(db as never, "user-1", {
      ...baseInput,
      confirmations: [],
      newItems: [newItem("baby spinach", 1)],
    });

    expect(res).toMatchObject({ confirmed: 0, added: 1 });
    expect(normalizeLineItem).toHaveBeenCalledWith(
      expect.objectContaining({ name: "baby spinach", rawText: "baby spinach", upc: null }),
      expect.anything(),
    );
    expect(createCanonical).not.toHaveBeenCalled(); // resolved → no create fallback
    expect(appendLedgerAndReproject).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        canonicalItemId: "canon-spinach",
        eventType: "vision_confirmed",
        baseQtyDelta: 1,
        ratePerDay: null,
      }),
    );
    expect(db.update).not.toHaveBeenCalled();
  });

  it("falls back to createCanonical when the cascade can't resolve a new label", async () => {
    const db = makeDb([]);
    normalizeLineItem.mockResolvedValue({
      canonicalItemId: null,
      method: "manual",
      confidence: 0,
      needsReview: true,
    });

    const res = await applyVisionScan(db as never, "user-1", {
      ...baseInput,
      confirmations: [],
      newItems: [newItem("mystery jar", 1)],
    });

    expect(res.added).toBe(1);
    expect(createCanonical).toHaveBeenCalledWith("mystery jar");
    expect(appendLedgerAndReproject).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ canonicalItemId: "canon-created" }),
    );
  });

  it("uses a pre-resolved canonicalItemId on a new item without calling the cascade", async () => {
    const db = makeDb([]);

    await applyVisionScan(db as never, "user-1", {
      ...baseInput,
      confirmations: [],
      newItems: [newItem("olive oil", 1, "canon-oil")],
    });

    expect(normalizeLineItem).not.toHaveBeenCalled();
    expect(createCanonical).not.toHaveBeenCalled();
    expect(appendLedgerAndReproject).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ canonicalItemId: "canon-oil" }),
    );
  });

  it("degrades with no AI keys: builds no Gemini client and ports get no embedding/LLM deps", async () => {
    loadEnv.mockReturnValue({}); // no GEMINI_API_KEY / GOOGLE_VERTEX_PROJECT
    const db = makeDb([]);
    normalizeLineItem.mockResolvedValue({
      canonicalItemId: "canon-x",
      method: "trigram",
      confidence: 0.9,
      needsReview: false,
    });

    await applyVisionScan(db as never, "user-1", {
      ...baseInput,
      confirmations: [],
      newItems: [newItem("oats", 1)],
    });

    expect(getGeminiClient).not.toHaveBeenCalled();
    expect(createGeminiEmbedder).not.toHaveBeenCalled();
    expect(createLlmNormalizer).not.toHaveBeenCalled();
    expect(createDbNormalizationPorts).toHaveBeenCalledWith(db, "user-1", undefined);
  });

  it("wires the embedder + LLM deps into the cascade when a Gemini key is present", async () => {
    loadEnv.mockReturnValue({ GEMINI_API_KEY: "k" });
    const db = makeDb([]);
    normalizeLineItem.mockResolvedValue({
      canonicalItemId: "canon-y",
      method: "embedding",
      confidence: 0.9,
      needsReview: false,
    });

    await applyVisionScan(db as never, "user-1", {
      ...baseInput,
      confirmations: [],
      newItems: [newItem("kale", 1)],
    });

    expect(getGeminiClient).toHaveBeenCalledTimes(1);
    expect(createDbNormalizationPorts).toHaveBeenCalledWith(
      db,
      "user-1",
      expect.objectContaining({ embed: expect.anything(), llm: expect.anything() }),
    );
  });

  it("skips a confirmation that carries no canonicalItemId (nothing to re-ground)", async () => {
    const db = makeDb([]);

    const res = await applyVisionScan(db as never, "user-1", {
      ...baseInput,
      confirmations: [{ ...confirm("ignored", 1), canonicalItemId: null }],
      newItems: [],
    });

    expect(res.confirmed).toBe(0);
    expect(appendLedgerAndReproject).not.toHaveBeenCalled();
  });

  it("defaults a missing qtyEstimate to 1 for both a re-stock and a new item", async () => {
    const db = makeDb([{ id: "salt", status: "out", qty: 0, rate: null }]);
    normalizeLineItem.mockResolvedValue({
      canonicalItemId: "canon-pepper",
      method: "trigram",
      confidence: 0.9,
      needsReview: false,
    });

    await applyVisionScan(db as never, "user-1", {
      ...baseInput,
      confirmations: [{ ...confirm("salt", 0), qtyEstimate: null }],
      newItems: [{ ...newItem("pepper", 0), qtyEstimate: null }],
    });

    // both the empty-restock and the new-seed fall back to a quantity of 1
    expect(appendLedgerAndReproject).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ canonicalItemId: "salt", baseQtyDelta: 1 }),
    );
    expect(appendLedgerAndReproject).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ canonicalItemId: "canon-pepper", baseQtyDelta: 1 }),
    );
  });

  it("handles a mixed batch (confirm + add) and reports honest counts", async () => {
    const db = makeDb([{ id: "eggs", status: "in_stock", qty: "6", rate: "0.3" }]);
    normalizeLineItem.mockResolvedValue({
      canonicalItemId: "canon-new",
      method: "trigram",
      confidence: 0.9,
      needsReview: false,
    });

    const res = await applyVisionScan(db as never, "user-1", {
      ...baseInput,
      confirmations: [confirm("eggs", 12)],
      newItems: [newItem("paprika", 1)],
    });

    expect(res).toMatchObject({ confirmed: 1, added: 1 });
    expect(appendLedgerAndReproject).toHaveBeenCalledTimes(2);
    expect(db.update).not.toHaveBeenCalled();
  });
});
