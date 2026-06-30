/**
 * Pure unit tests for logCook (PLAN §7.2 + §8.7 — the cook → pantry → taste loop).
 *
 * log-cook.test.ts already covers the clampMacros helper, but the logCook ORCHESTRATION (recipe
 * upsert, the consume_recipe ledger writes, the mealLog guard, cuisine learning) shipped at ~8%
 * coverage because the only end-to-end exercise lives in skipIf-gated integration tests that never
 * run in CI. The DB-touching helpers (getPantryView, appendPreferenceSignal) and the ledger writer
 * are mocked at the module boundary, and a thin chainable Drizzle-shaped fake `db` replays the exact
 * query shapes logCook issues, so the orchestration runs in plain CI with no infra. The pure pieces
 * it composes — planConsumption, UnitConverter, signalFromCooked, clampMacros — keep their own tests;
 * here we lock the wiring logCook owns:
 *   - the recipe header is reused when found, else inserted (dedupe by provider + externalId);
 *   - a consume_recipe ledger event fires per planned delta, preserving the item's learned rate;
 *   - macros are clamped before they hit the mealLog row;
 *   - an empty mealLog insert THROWS (never leaves dangling pantry decrements);
 *   - a cuisine learns a preference signal; no cuisine learns nothing.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// --- routable fake db ------------------------------------------------------
// Sentinel table objects (the @gm/db mock exports these); the fake routes query results by ._name.
const T = (name: string) => ({ _name: name });
const canonicalItems = T("canonicalItems");
const mealLogs = T("mealLogs");
const pantryStock = T("pantryStock");
const recipes = T("recipes");
const unitsOfMeasure = T("unitsOfMeasure");

// SELECT results per table, set per test.
let ROUTES: Record<string, unknown[]> = {};
// What insert(table).values(..).returning(..) yields per table, set per test.
let INSERT_RETURNS: Record<string, unknown[]> = {};
// Capture the row passed to insert(table).values(row) so a test can assert it (e.g. clamped macros).
const insertValues: Record<string, ReturnType<typeof vi.fn>> = {};

/**
 * A chainable, thenable query stand-in. Every builder method (from/innerJoin/where/limit/orderBy)
 * returns the same chain, and awaiting it resolves to ROUTES[table]. `.from(t)` (re)binds the table.
 */
function queryResult(tableName: string | null): Record<string, unknown> {
  const rows = (tableName && ROUTES[tableName]) || [];
  const chain: Record<string, unknown> = {
    from: (t: { _name: string }) => queryResult(t._name),
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    limit: () => chain,
    orderBy: () => chain,
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
      return { returning: vi.fn(async () => INSERT_RETURNS[t._name] ?? [{ id: `${t._name}-1` }]) };
    }),
  }));
  return { select, insert };
}

// --- module boundary mocks -------------------------------------------------
const getPantryView = vi.fn<(db: unknown, userId: string) => Promise<unknown[]>>(async () => []);
const appendPreferenceSignal = vi.fn<(db: unknown, a: Record<string, unknown>) => Promise<unknown>>(
  async () => ({}),
);
vi.mock("@gm/db", () => ({
  getPantryView: (db: unknown, userId: string) => getPantryView(db, userId),
  appendPreferenceSignal: (db: unknown, a: Record<string, unknown>) => appendPreferenceSignal(db, a),
  canonicalItems,
  mealLogs,
  pantryStock,
  recipes,
  unitsOfMeasure,
}));

const appendLedgerAndReproject = vi.fn<(db: unknown, a: Record<string, unknown>) => Promise<unknown>>(
  async () => ({}),
);
vi.mock("../pantry/persist.js", () => ({
  appendLedgerAndReproject: (db: unknown, a: Record<string, unknown>) =>
    appendLedgerAndReproject(db, a),
}));

// Import AFTER the mocks are registered. signalFromCooked / UnitConverter / planConsumption are pure
// and intentionally NOT mocked — we exercise the real composition.
const { logCook } = await import("./log-cook.js");

// A pantry of one COUNT-unit item ("eggs"), and the unit/base-unit rows the converter + resolver need.
function seedEggsPantry() {
  getPantryView.mockResolvedValue([
    { canonicalItemId: "eggs", name: "eggs", aliases: [], baseQtyOnHand: "6" },
  ]);
  ROUTES = {
    unitsOfMeasure: [{ code: "ct", dimension: "COUNT", toBaseFactor: 1 }],
    canonicalItems: [{ id: "eggs", code: "ct", dimension: "COUNT" }],
    pantryStock: [{ id: "eggs", rate: "0.2" }],
    recipes: [],
  };
  INSERT_RETURNS = { mealLogs: [{ id: "meal-1" }], recipes: [{ id: "recipe-1" }] };
}

afterEach(() => {
  vi.clearAllMocks();
  ROUTES = {};
  INSERT_RETURNS = {};
  for (const k of Object.keys(insertValues)) delete insertValues[k];
});

describe("logCook", () => {
  it("decrements a measurable matched ingredient via a consume_recipe ledger event (rate preserved)", async () => {
    seedEggsPantry();
    const db = makeDb();

    const res = await logCook(
      db as never,
      "user-1",
      { recipeId: "r-existing", externalId: "x1", title: "Omelette", cuisine: "Italian", ingredients: [{ name: "eggs", measure: "2" }] },
    );

    expect(res).toMatchObject({
      recipeId: "r-existing",
      mealLogId: "meal-1",
      decremented: 1,
      usedUnmeasured: 0,
      learnedCuisine: "italian",
    });
    expect(appendLedgerAndReproject).toHaveBeenCalledTimes(1);
    expect(appendLedgerAndReproject).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        userId: "user-1",
        canonicalItemId: "eggs",
        eventType: "consume_recipe",
        baseQtyDelta: -2, // min(2 requested, 6 on hand)
        refType: "meal_log",
        refId: "meal-1",
        ratePerDay: 0.2, // learned rate carried into the event, not reset
      }),
    );
    // a pre-resolved recipeId skips the provider upsert
    expect(db.insert).toHaveBeenCalledTimes(1); // mealLogs only
  });

  it("upserts the recipe header when no recipeId is given and the lookup misses", async () => {
    seedEggsPantry(); // recipes route is [] → lookup misses → insert
    const db = makeDb();

    const res = await logCook(
      db as never,
      "user-1",
      { externalId: "tm-123", title: "New Dish", ingredients: [{ name: "eggs", measure: "1" }] },
    );

    expect(res.recipeId).toBe("recipe-1"); // came from the recipes insert
    expect(insertValues.recipes).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "themealdb", externalId: "tm-123", title: "New Dish" }),
    );
  });

  it("clamps hallucinated macros before they reach the mealLog row", async () => {
    seedEggsPantry();
    const db = makeDb();

    await logCook(
      db as never,
      "user-1",
      { recipeId: "r1", externalId: "x", title: "T", ingredients: [] },
      { macros: { kcal: 99999, proteinG: 9999, carbsG: -5, fatG: 12, source: "llm", confidence: 0.4 } },
    );

    expect(insertValues.mealLogs).toHaveBeenCalledWith(
      expect.objectContaining({ kcal: 10000, proteinG: 500, carbsG: 0, fatG: 12, macrosSource: "llm" }),
    );
  });

  it("THROWS when the mealLog insert returns no row (never leaves dangling decrements)", async () => {
    seedEggsPantry();
    INSERT_RETURNS.mealLogs = []; // simulate a silent insert failure
    const db = makeDb();

    await expect(
      logCook(db as never, "user-1", { recipeId: "r1", externalId: "x", title: "T", ingredients: [{ name: "eggs", measure: "2" }] }),
    ).rejects.toThrow(/mealLogs insert returned no row/);
    expect(appendLedgerAndReproject).not.toHaveBeenCalled(); // threw before any decrement
  });

  it("learns no cuisine signal when the recipe has no cuisine", async () => {
    seedEggsPantry();
    const db = makeDb();

    const res = await logCook(
      db as never,
      "user-1",
      { recipeId: "r1", externalId: "x", title: "T", ingredients: [{ name: "eggs", measure: "2" }] },
    );

    expect(res.learnedCuisine).toBeNull();
    expect(appendPreferenceSignal).not.toHaveBeenCalled();
  });

  it("records an unmeasured match (no ledger delta) when the measure can't be quantified", async () => {
    seedEggsPantry();
    const db = makeDb();

    const res = await logCook(
      db as never,
      "user-1",
      { recipeId: "r1", externalId: "x", title: "T", ingredients: [{ name: "eggs", measure: "to taste" }] },
    );

    expect(res.decremented).toBe(0);
    expect(res.usedUnmeasured).toBe(1);
    expect(appendLedgerAndReproject).not.toHaveBeenCalled();
  });

  it("scales the consumed quantity by servingsMade", async () => {
    seedEggsPantry();
    const db = makeDb();

    await logCook(
      db as never,
      "user-1",
      { recipeId: "r1", externalId: "x", title: "T", ingredients: [{ name: "eggs", measure: "2" }] },
      { servingsMade: 2 },
    );

    // 2 eggs × 2 servings = 4 requested, min(4, 6 on hand) = 4
    expect(appendLedgerAndReproject).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ canonicalItemId: "eggs", baseQtyDelta: -4 }),
    );
  });
});
