/**
 * Pure unit tests for resolveScanLabels (PLAN §5.4 cascade applied to detection labels).
 *
 * resolveScanLabels reaches the DB via withTenant + normalizeLineItem, so we mock those module
 * boundaries wholesale — every query path lives inside normalizeLineItem (covered by its own tests),
 * so this is a thin pass-through mock, NOT a brittle Drizzle query mock. What we lock here is the
 * orchestration resolve owns: distinct-label dedup, method/canonical mapping, the no-keys degrade
 * (build no embedder/llm deps), and the load-bearing invariant that a per-label failure resolves to
 * a harmless "manual" miss instead of crashing the whole scan (best-effort, §the resolve docstring).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NormalizationResult } from "../ingestion/normalize.js";

// --- module boundary mocks -------------------------------------------------
const loadEnv = vi.fn<() => Record<string, string | undefined>>(() => ({}));
vi.mock("@gm/config/env", () => ({ loadEnv: () => loadEnv() }));

// withTenant just runs the callback with a dummy tx — resolve delegates all query work to
// normalizeLineItem, which we mock, so the tx object is never actually used.
const withTenant = vi.fn(async (_db: unknown, _userId: string, fn: (tx: unknown) => unknown) => fn({}));
vi.mock("@gm/db", () => ({
  getDb: () => ({}),
  withTenant: (db: unknown, userId: string, fn: (tx: unknown) => unknown) => withTenant(db, userId, fn),
}));

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

const createDbNormalizationPorts = vi.fn<(tx: unknown, userId: string, deps: unknown) => unknown>(
  () => ({}),
);
vi.mock("../ingestion/db-ports.js", () => ({
  createDbNormalizationPorts: (tx: unknown, userId: string, deps: unknown) =>
    createDbNormalizationPorts(tx, userId, deps),
}));

// Forward BOTH args (input, ports) so a test can assert resolve threads the ports object built by
// createDbNormalizationPorts into normalizeLineItem — dropping `ports` here would hide a regression
// that broke that wire (the cascade would silently lose its DB/embedder/llm access).
const normalizeLineItem =
  vi.fn<(input: { name: string }, ports: unknown) => Promise<NormalizationResult>>();
vi.mock("../ingestion/normalize.js", () => ({
  normalizeLineItem: (input: { name: string }, ports: unknown) => normalizeLineItem(input, ports),
}));

// Import AFTER the mocks are registered.
const { resolveScanLabels } = await import("./resolve.js");

const norm = (canonicalItemId: string | null, method: NormalizationResult["method"]): NormalizationResult => ({
  canonicalItemId,
  method,
  confidence: canonicalItemId ? 0.9 : 0,
  needsReview: false,
});

afterEach(() => {
  vi.clearAllMocks();
  loadEnv.mockReturnValue({});
});

describe("resolveScanLabels", () => {
  it("maps each label to its normalized canonical + method", async () => {
    normalizeLineItem.mockImplementation(async ({ name }) =>
      name === "pop" ? norm("can-soda", "embedding") : norm("can-yogurt", "trigram"),
    );

    const out = await resolveScanLabels("user-1", ["pop", "greek yog"]);

    expect(out.get("pop")).toEqual({ canonicalItemId: "can-soda", method: "embedding" });
    expect(out.get("greek yog")).toEqual({ canonicalItemId: "can-yogurt", method: "trigram" });
    expect(out.size).toBe(2);
    // resolve must thread the line item AND the built ports into the cascade — assert both args so
    // a regression that stopped passing `ports` (losing DB/embedder/llm access) can't pass silently.
    expect(normalizeLineItem).toHaveBeenCalledWith(
      expect.objectContaining({ name: "pop", rawText: "pop", upc: null }),
      expect.anything(),
    );
  });

  it("dedups repeated labels — one normalize call per distinct label", async () => {
    normalizeLineItem.mockResolvedValue(norm("can-x", "trigram"));

    const out = await resolveScanLabels("user-1", ["milk", "milk", "milk"]);

    expect(normalizeLineItem).toHaveBeenCalledTimes(1);
    expect(out.size).toBe(1);
    expect(out.get("milk")).toEqual({ canonicalItemId: "can-x", method: "trigram" });
  });

  it("INVARIANT: a per-label failure resolves to a harmless manual miss, never crashing the scan", async () => {
    normalizeLineItem.mockImplementation(async ({ name }) => {
      if (name === "boom") throw new Error("embedder timeout");
      return norm("can-ok", "trigram");
    });

    const out = await resolveScanLabels("user-1", ["boom", "fine"]);

    // The throwing label degrades to a null/manual miss (caller falls back to token matching)...
    expect(out.get("boom")).toEqual({ canonicalItemId: null, method: "manual" });
    // ...and the OTHER label still resolves — one bad label does not poison the batch.
    expect(out.get("fine")).toEqual({ canonicalItemId: "can-ok", method: "trigram" });
  });

  it("degrades with no AI keys: builds no embedder/llm deps", async () => {
    loadEnv.mockReturnValue({}); // no GEMINI_API_KEY / GOOGLE_VERTEX_PROJECT
    normalizeLineItem.mockResolvedValue(norm(null, "manual"));

    await resolveScanLabels("user-1", ["mystery item"]);

    expect(getGeminiClient).not.toHaveBeenCalled();
    expect(createGeminiEmbedder).not.toHaveBeenCalled();
    expect(createLlmNormalizer).not.toHaveBeenCalled();
    // ports still built, just without AI deps
    expect(createDbNormalizationPorts).toHaveBeenCalledWith(expect.anything(), "user-1", undefined);
  });

  it("wires the embedder + llm deps when a Gemini key is present", async () => {
    loadEnv.mockReturnValue({ GEMINI_API_KEY: "k" });
    normalizeLineItem.mockResolvedValue(norm("can-y", "embedding"));

    await resolveScanLabels("user-1", ["pop"]);

    expect(getGeminiClient).toHaveBeenCalledTimes(1);
    expect(createGeminiEmbedder).toHaveBeenCalledTimes(1);
    expect(createLlmNormalizer).toHaveBeenCalledTimes(1);
    // the built deps are threaded into the ports for the cascade's embedding/llm stages
    expect(createDbNormalizationPorts).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.objectContaining({ embed: expect.anything(), llm: expect.anything() }),
    );
  });

  it("returns an empty map for no labels (no normalize calls)", async () => {
    const out = await resolveScanLabels("user-1", []);
    expect(out.size).toBe(0);
    expect(normalizeLineItem).not.toHaveBeenCalled();
  });
});
