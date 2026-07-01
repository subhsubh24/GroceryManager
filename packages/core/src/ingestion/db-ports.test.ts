import { describe, expect, it, vi } from "vitest";
import type { Querier } from "@gm/db";
import { createDbNormalizationPorts } from "./db-ports.js";
import { matchShelfLifeRule } from "../pantry/shelf-life.js";

/**
 * Unit coverage for the DB-backed NormalizationPorts (§5.4). These are the real port
 * implementations — the only other exercise is `ingest.integration.test.ts`, which is
 * `describe.skipIf(!url)` and never runs in CI. A tiny fake `Querier` feeds canned rows so the
 * branching logic (override key selection, missing-dependency short-circuits, the createCanonical
 * slug-conflict reuse fallback + shelf-life selection) is verified keyless.
 */

interface FakeConfig {
  /** One result array per `db.select()...limit()` call, in call order. */
  selectResults?: unknown[][];
  /** One result array per `db.insert()...returning()` call, in call order. */
  insertResults?: unknown[][];
  /** One result array per `db.execute()` call, in call order. */
  executeResults?: unknown[][];
}

function makeFakeDb(cfg: FakeConfig = {}) {
  const selectResults = cfg.selectResults ?? [];
  const insertResults = cfg.insertResults ?? [];
  const executeResults = cfg.executeResults ?? [];
  let s = 0;
  let i = 0;
  let e = 0;
  const insertValues: Record<string, unknown>[] = [];

  const db = {
    select() {
      const chain = {
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(selectResults[s++] ?? []),
      };
      return chain;
    },
    insert() {
      const chain = {
        values: (v: Record<string, unknown>) => {
          insertValues.push(v);
          return chain;
        },
        onConflictDoNothing: () => chain,
        returning: () => Promise.resolve(insertResults[i++] ?? []),
      };
      return chain;
    },
    execute: () => Promise.resolve(executeResults[e++] ?? []),
  };

  return { db: db as unknown as Querier, insertValues };
}

describe("createDbNormalizationPorts — findOverride", () => {
  it("returns null without touching the DB when neither rawText nor upc is given", async () => {
    const { db } = makeFakeDb();
    const ports = createDbNormalizationPorts(db, "user-1");
    expect(await ports.findOverride(null, null)).toBeNull();
  });

  it("resolves a match on the rawText branch", async () => {
    const { db } = makeFakeDb({ selectResults: [[{ id: "canon-raw" }]] });
    const ports = createDbNormalizationPorts(db, "user-1");
    expect(await ports.findOverride("365 ORG WHOLE MILK", null)).toBe("canon-raw");
  });

  it("resolves a match on the upc branch", async () => {
    const { db } = makeFakeDb({ selectResults: [[{ id: "canon-upc" }]] });
    const ports = createDbNormalizationPorts(db, "user-1");
    expect(await ports.findOverride(null, "099482400000")).toBe("canon-upc");
  });

  it("returns null when the override table has no row", async () => {
    const { db } = makeFakeDb({ selectResults: [[]] });
    const ports = createDbNormalizationPorts(db, "user-1");
    expect(await ports.findOverride("no match", null)).toBeNull();
  });
});

describe("createDbNormalizationPorts — findByUpc", () => {
  it("returns the product's canonical id, else null", async () => {
    const hit = makeFakeDb({ selectResults: [[{ id: "prod-canon" }]] });
    expect(await createDbNormalizationPorts(hit.db, "u").findByUpc("111")).toBe("prod-canon");

    const miss = makeFakeDb({ selectResults: [[]] });
    expect(await createDbNormalizationPorts(miss.db, "u").findByUpc("222")).toBeNull();
  });
});

describe("createDbNormalizationPorts — trigramCandidates", () => {
  it("maps rows and coerces the score to a number", async () => {
    const { db } = makeFakeDb({
      executeResults: [[{ id: "a", name: "Apple", score: "0.8" }]],
    });
    const ports = createDbNormalizationPorts(db, "u");
    expect(await ports.trigramCandidates("apple", 5)).toEqual([
      { id: "a", name: "Apple", score: 0.8 },
    ]);
  });
});

describe("createDbNormalizationPorts — embeddingCandidates", () => {
  it("short-circuits to [] when no embedder is injected (never calls the DB)", async () => {
    const { db } = makeFakeDb();
    const ports = createDbNormalizationPorts(db, "u");
    expect(await ports.embeddingCandidates("apple", 5)).toEqual([]);
  });

  it("embeds then maps the cosine results when an embedder is injected", async () => {
    const embed = vi.fn(async () => [0.1, 0.2, 0.3]);
    const { db } = makeFakeDb({
      executeResults: [[{ id: "b", name: "Banana", score: "0.91" }]],
    });
    const ports = createDbNormalizationPorts(db, "u", { embed });
    expect(await ports.embeddingCandidates("banana", 5)).toEqual([
      { id: "b", name: "Banana", score: 0.91 },
    ]);
    expect(embed).toHaveBeenCalledWith("banana");
  });
});

describe("createDbNormalizationPorts — llmResolve", () => {
  it("returns a no-match with 0 confidence when no LLM is injected", async () => {
    const { db } = makeFakeDb();
    const ports = createDbNormalizationPorts(db, "u");
    expect(await ports.llmResolve("mystery", [])).toEqual({
      canonicalItemId: null,
      createName: null,
      confidence: 0,
    });
  });

  it("delegates to the injected LLM", async () => {
    const llm = vi.fn(async () => ({ canonicalItemId: "x", createName: null, confidence: 0.7 }));
    const { db } = makeFakeDb();
    const ports = createDbNormalizationPorts(db, "u", { llm });
    const candidates = [{ id: "x", name: "X", score: 0.5 }];
    expect(await ports.llmResolve("mystery", candidates)).toEqual({
      canonicalItemId: "x",
      createName: null,
      confidence: 0.7,
    });
    expect(llm).toHaveBeenCalledWith("mystery", candidates);
  });
});

describe("createDbNormalizationPorts — createCanonical", () => {
  it("throws when the base unit 'each' is not seeded", async () => {
    const { db } = makeFakeDb({ selectResults: [[]] });
    const ports = createDbNormalizationPorts(db, "u");
    await expect(ports.createCanonical("whole milk")).rejects.toThrow(/base unit/i);
  });

  it("inserts a new canonical with a slugified name + seeded shelf life", async () => {
    const { db, insertValues } = makeFakeDb({
      selectResults: [[{ id: "unit-each" }]],
      insertResults: [[{ id: "canon-new" }]],
    });
    const ports = createDbNormalizationPorts(db, "u");
    expect(await ports.createCanonical("Organic Whole Milk!!")).toBe("canon-new");
    expect(insertValues).toHaveLength(1);
    const row = insertValues[0]!;
    expect(row.name).toBe("Organic Whole Milk!!");
    expect(row.slug).toBe("organic-whole-milk");
    expect(row.baseUnitId).toBe("unit-each");
    // Shelf-life fields are always seeded so the depletion spoilage ceiling works for new items.
    expect(row.domain).toBeTruthy();
    expect(row.perishability).toBeTruthy();
  });

  it("reuses the existing canonical when the slug already exists (idempotency, not a crash)", async () => {
    // insert returns [] (slug conflict → onConflictDoNothing), then the existing-slug select hits.
    const { db } = makeFakeDb({
      selectResults: [[{ id: "unit-each" }], [{ id: "canon-existing" }]],
      insertResults: [[]],
    });
    const ports = createDbNormalizationPorts(db, "u");
    expect(await ports.createCanonical("whole milk")).toBe("canon-existing");
  });

  it("throws when it can neither create nor find the slug", async () => {
    const { db } = makeFakeDb({
      selectResults: [[{ id: "unit-each" }], []],
      insertResults: [[]],
    });
    const ports = createDbNormalizationPorts(db, "u");
    await expect(ports.createCanonical("whole milk")).rejects.toThrow(/failed to create or find slug/i);
  });

  it("uses the LLM shelf-life estimator only for UNKNOWN foods, not known ones", async () => {
    const shelfLife = vi.fn(async () => ({
      domain: "grocery" as const,
      perishability: "perishable" as const,
      shelfLifeFridgeDays: 6,
      shelfLifePantryDays: 2,
    }));

    // Known food → the keyword heuristic wins, the estimator is skipped.
    const knownRule = matchShelfLifeRule("whole milk");
    expect(knownRule).toBeTruthy();
    const known = makeFakeDb({
      selectResults: [[{ id: "unit-each" }]],
      insertResults: [[{ id: "canon-known" }]],
    });
    await createDbNormalizationPorts(known.db, "u", { shelfLife }).createCanonical("whole milk");
    expect(shelfLife).not.toHaveBeenCalled();
    expect(known.insertValues[0]!.perishability).toBe(knownRule!.perishability);

    // Unknown food → no keyword rule, so the injected estimator is consulted.
    expect(matchShelfLifeRule("zorptrax gel")).toBeNull();
    const unknown = makeFakeDb({
      selectResults: [[{ id: "unit-each" }]],
      insertResults: [[{ id: "canon-unknown" }]],
    });
    await createDbNormalizationPorts(unknown.db, "u", { shelfLife }).createCanonical("zorptrax gel");
    expect(shelfLife).toHaveBeenCalledWith("zorptrax gel");
    expect(unknown.insertValues[0]!.perishability).toBe("perishable");
  });
});
