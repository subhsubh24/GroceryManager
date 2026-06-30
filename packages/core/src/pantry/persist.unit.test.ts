/**
 * Pure unit tests for appendLedgerAndReproject + reprojectStock (PLAN §6 — the ledger-only invariant
 * engine). EVERY stock mutation in the app flows through here, yet the orchestration shipped at ~1%
 * coverage because the only end-to-end exercise lives in skipIf-gated integration tests that never run
 * in CI (TEST_DATABASE_URL is unset). The DB is the only side-effect, so a thin chainable
 * Drizzle-shaped fake `db` replays the exact query shapes these functions issue, and the pure pieces
 * they compose — projectPantryStock, ewmaConsumptionRate — keep their own tests and run for real here.
 *
 * What we lock (the wiring persist.ts owns, not the depletion math):
 *   - append writes a stock_ledger row with the delta coerced to a string + sane confidence/ref defaults;
 *   - reproject derives lastPurchaseAt from POSITIVE deltas only (a zero-delta confirm never shifts it);
 *   - reproject derives lastConfirmedAt from vision_confirmed OR zero-delta events;
 *   - an explicit caller ratePerDay wins; otherwise the EWMA is learned from purchase cadence;
 *   - `source` is stamped into the upsert ONLY when the caller asserts it (else the row keeps its own);
 *   - the projection is upserted on the (user,item) conflict target — stock is never written elsewhere.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// --- routable fake db ------------------------------------------------------
// Sentinel table objects (the @gm/db mock exports these); the fake routes SELECTs by ._name.
const T = (name: string) => ({ _name: name });
const canonicalItems = T("canonicalItems");
const pantryStock = T("pantryStock");
const stockLedger = T("stockLedger");

// SELECT results per table, set per test.
let ROUTES: Record<string, unknown[]> = {};
// Capture the row passed to insert(table).values(row) so a test can assert it.
const insertValues: Record<string, ReturnType<typeof vi.fn>> = {};
// Capture the onConflictDoUpdate arg (target + set) for the pantryStock upsert.
const conflictArgs: Record<string, ReturnType<typeof vi.fn>> = {};

/** A chainable, thenable SELECT stand-in; `.from(t)` (re)binds the table → ROUTES[t]. */
function queryResult(tableName: string | null): Record<string, unknown> {
  const rows = (tableName && ROUTES[tableName]) || [];
  const chain: Record<string, unknown> = {
    from: (t: { _name: string }) => queryResult(t._name),
    where: () => chain,
    limit: () => chain,
    then: (onF: (v: unknown[]) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(onF, onR),
  };
  return chain;
}

function makeDb() {
  const select = vi.fn(() => queryResult(null));
  const insert = vi.fn((t: { _name: string }) => ({
    values: vi.fn((row: unknown) => {
      (insertValues[t._name] ??= vi.fn())(row);
      // Awaitable directly (stock_ledger insert) AND chainable with onConflictDoUpdate (pantry upsert).
      const result: Record<string, unknown> = {
        onConflictDoUpdate: vi.fn((arg: unknown) => {
          (conflictArgs[t._name] ??= vi.fn())(arg);
          return Promise.resolve(undefined);
        }),
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
          Promise.resolve(undefined).then(onF, onR),
      };
      return result;
    }),
  }));
  return { select, insert };
}

// --- module boundary mocks -------------------------------------------------
// Only the @gm/db table sentinels are mocked. depletion.js + project.js are pure → exercised for real.
vi.mock("@gm/db", () => ({ canonicalItems, pantryStock, stockLedger }));

const { appendLedgerAndReproject, reprojectStock } = await import("./persist.js");

// A perishable canonical item with a fridge shelf life (so the spoilage ceiling participates).
function seedPerishableItem() {
  ROUTES.canonicalItems = [{ perishability: "perishable", fridge: 14, pantryDays: null }];
}

afterEach(() => {
  vi.clearAllMocks();
  ROUTES = {};
  for (const k of Object.keys(insertValues)) delete insertValues[k];
  for (const k of Object.keys(conflictArgs)) delete conflictArgs[k];
});

describe("appendLedgerAndReproject", () => {
  it("writes a stock_ledger row with the delta stringified and sane defaults, then reprojects", async () => {
    seedPerishableItem();
    ROUTES.stockLedger = []; // no prior events → first acquisition is the one we just appended (simulated)
    const db = makeDb();

    const occurredAt = new Date("2026-06-01T00:00:00Z");
    await appendLedgerAndReproject(db as never, {
      userId: "user-1",
      canonicalItemId: "milk",
      baseQtyDelta: 2,
      eventType: "purchase",
      occurredAt,
    });

    expect(insertValues.stockLedger).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        canonicalItemId: "milk",
        baseQtyDelta: "2", // coerced to string for the numeric column
        eventType: "purchase",
        confidence: 1, // default when not supplied
        refType: null,
        refId: null,
        occurredAt,
      }),
    );
    // The projection is upserted (reproject ran after the append).
    expect(insertValues.pantryStock).toHaveBeenCalledTimes(1);
  });

  it("defaults occurredAt to now and passes through an explicit confidence + refs", async () => {
    seedPerishableItem();
    ROUTES.stockLedger = [];
    const db = makeDb();

    await appendLedgerAndReproject(db as never, {
      userId: "u",
      canonicalItemId: "eggs",
      baseQtyDelta: -1,
      eventType: "consume_recipe",
      confidence: 0.5,
      refType: "meal_log",
      refId: "meal-9",
    });

    const row = insertValues.stockLedger!.mock.calls[0]![0] as Record<string, unknown>;
    expect(row).toMatchObject({
      confidence: 0.5,
      refType: "meal_log",
      refId: "meal-9",
      baseQtyDelta: "-1",
    });
    expect(row.occurredAt).toBeInstanceOf(Date); // defaulted, not undefined
  });
});

describe("reprojectStock", () => {
  it("derives lastPurchaseAt from positive deltas only — a zero-delta confirm never shifts it", async () => {
    seedPerishableItem();
    const buy = new Date("2026-06-01T00:00:00Z");
    const confirm = new Date("2026-06-20T00:00:00Z"); // later, but zero-delta → must NOT become lastPurchaseAt
    ROUTES.stockLedger = [
      { delta: "3", occurredAt: buy, eventType: "purchase" },
      { delta: "0", occurredAt: confirm, eventType: "manual_confirm" },
    ];
    const db = makeDb();

    await reprojectStock(db as never, "user-1", "milk", null);

    const upserted = insertValues.pantryStock!.mock.calls[0]![0] as Record<string, unknown>;
    expect(upserted.lastPurchaseAt).toEqual(buy); // the zero-delta confirm did not move it
    expect(upserted.lastConfirmedAt).toEqual(confirm); // but it IS the latest confirmation
  });

  it("treats a vision_confirmed event as a confirmation even with a positive delta", async () => {
    seedPerishableItem();
    const scan = new Date("2026-06-15T00:00:00Z");
    ROUTES.stockLedger = [{ delta: "1", occurredAt: scan, eventType: "vision_confirmed" }];
    const db = makeDb();

    await reprojectStock(db as never, "user-1", "spinach", null);

    const upserted = insertValues.pantryStock!.mock.calls[0]![0] as Record<string, unknown>;
    expect(upserted.lastPurchaseAt).toEqual(scan); // positive delta → also an acquisition
    expect(upserted.lastConfirmedAt).toEqual(scan); // vision_confirmed → a confirmation too
  });

  it("upserts on the (user,item) conflict target and only there (the ledger-only invariant)", async () => {
    seedPerishableItem();
    ROUTES.stockLedger = [{ delta: "2", occurredAt: new Date("2026-06-01T00:00:00Z"), eventType: "purchase" }];
    const db = makeDb();

    await reprojectStock(db as never, "user-1", "milk", null);

    // Exactly one write, and it targets the pantryStock composite key.
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalledWith(pantryStock);
    const conflict = conflictArgs.pantryStock!.mock.calls[0]![0] as { target: unknown[]; set: Record<string, unknown> };
    expect(conflict.target).toHaveLength(2); // [userId, canonicalItemId]
    // The UPDATE side must carry the projection, not just updatedAt — else a regression that dropped
    // fields from `set` (while keeping them in the INSERT values) would silently leave stale rows stale.
    expect(conflict.set).toMatchObject({
      baseQtyOnHand: expect.any(String),
      status: expect.any(String),
      updatedAt: expect.any(Date),
    });
  });

  it("stamps `source` into the upsert when the caller asserts user_confirmed, and omits it otherwise", async () => {
    seedPerishableItem();
    ROUTES.stockLedger = [{ delta: "1", occurredAt: new Date("2026-06-01T00:00:00Z"), eventType: "vision_confirmed" }];

    const db1 = makeDb();
    await reprojectStock(db1 as never, "u", "milk", null, "user_confirmed");
    expect((insertValues.pantryStock!.mock.calls[0]![0] as Record<string, unknown>).source).toBe("user_confirmed");

    vi.clearAllMocks();
    for (const k of Object.keys(insertValues)) delete insertValues[k];
    ROUTES.canonicalItems = [{ perishability: "perishable", fridge: 14, pantryDays: null }];
    ROUTES.stockLedger = [{ delta: "1", occurredAt: new Date("2026-06-01T00:00:00Z"), eventType: "purchase" }];
    const db2 = makeDb();
    await reprojectStock(db2 as never, "u", "milk", null);
    expect((insertValues.pantryStock!.mock.calls[0]![0] as Record<string, unknown>)).not.toHaveProperty("source");
  });

  it("honors an explicit caller ratePerDay over the learned EWMA", async () => {
    seedPerishableItem();
    // Two purchases 10 days apart would learn a rate; the explicit 0.5 must win regardless.
    ROUTES.stockLedger = [
      { delta: "5", occurredAt: new Date("2026-06-01T00:00:00Z"), eventType: "purchase" },
      { delta: "5", occurredAt: new Date("2026-06-11T00:00:00Z"), eventType: "purchase" },
    ];
    const db = makeDb();

    await reprojectStock(db as never, "u", "rice", 0.5);

    const upserted = insertValues.pantryStock!.mock.calls[0]![0] as Record<string, unknown>;
    expect(upserted.estimatedConsumptionRatePerDay).toBe("0.5"); // stringified caller rate, not the learned one
  });

  it("learns the EWMA rate from purchase cadence when no caller rate is given", async () => {
    seedPerishableItem();
    ROUTES.stockLedger = [
      { delta: "7", occurredAt: new Date("2026-06-01T00:00:00Z"), eventType: "purchase" },
      { delta: "7", occurredAt: new Date("2026-06-08T00:00:00Z"), eventType: "purchase" }, // 7/wk ≈ 1/day
    ];
    const db = makeDb();

    await reprojectStock(db as never, "u", "bananas", null);

    const upserted = insertValues.pantryStock!.mock.calls[0]![0] as Record<string, unknown>;
    // A rate was learned (non-null) from the ≥2 purchases — exact value owned by depletion.test.ts.
    expect(upserted.estimatedConsumptionRatePerDay).not.toBeNull();
    expect(Number(upserted.estimatedConsumptionRatePerDay)).toBeGreaterThan(0);
  });

  it("handles an item with no canonical row (null shelf-life inputs) without throwing", async () => {
    ROUTES.canonicalItems = []; // item lookup misses → perishable:false, shelfLifeDays:null
    ROUTES.stockLedger = [{ delta: "2", occurredAt: new Date("2026-06-01T00:00:00Z"), eventType: "purchase" }];
    const db = makeDb();

    const proj = await reprojectStock(db as never, "u", "mystery", null);

    expect(proj).toHaveProperty("baseQtyOnHand");
    expect(insertValues.pantryStock).toHaveBeenCalledTimes(1);
  });

  it("nulls both timestamps when the ledger has no acquisitions or confirmations", async () => {
    seedPerishableItem();
    ROUTES.stockLedger = []; // empty ledger
    const db = makeDb();

    await reprojectStock(db as never, "u", "milk", null);

    const upserted = insertValues.pantryStock!.mock.calls[0]![0] as Record<string, unknown>;
    expect(upserted.lastPurchaseAt).toBeNull();
    expect(upserted.lastConfirmedAt).toBeNull();
  });
});
