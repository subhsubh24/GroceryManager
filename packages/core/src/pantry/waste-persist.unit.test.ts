/**
 * Pure unit tests for recordWaste (PLAN §10 — the "went bad / tossed it" action). It chains three
 * distinct side effects — a spoilage ledger event that zeroes stock, a weak negative taste signal,
 * and a reorder-par auto-tune-DOWN — yet shipped at ~2% coverage because its only exercise was a
 * skipIf-gated integration test that never runs in CI. The DB + the two writers are mocked at the
 * module boundary; signalFromWaste and tuneParForWaste are pure and run for real. We lock the wiring
 * recordWaste owns: the exact spoilage delta (−onHand, never positive), the learned rate carried into
 * the event, the negative-polarity signal, and the par-lowering decision (only when a policy exists
 * and the tune actually reduces it).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// --- routable fake db ------------------------------------------------------
const T = (name: string) => ({ _name: name });
const pantryStock = T("pantryStock");
const reorderPolicies = T("reorderPolicies");

let ROUTES: Record<string, unknown[]> = {};
const updateSet: Record<string, ReturnType<typeof vi.fn>> = {};

/** Chainable, thenable SELECT stand-in; `.from(t)` binds the table → ROUTES[t]. */
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
  const update = vi.fn((t: { _name: string }) => ({
    set: vi.fn((row: unknown) => {
      (updateSet[t._name] ??= vi.fn())(row);
      return { where: vi.fn(async () => undefined) };
    }),
  }));
  return { select, update };
}

// --- module boundary mocks -------------------------------------------------
const appendPreferenceSignal = vi.fn<(db: unknown, a: Record<string, unknown>) => Promise<unknown>>(
  async () => ({}),
);
vi.mock("@gm/db", () => ({
  appendPreferenceSignal: (db: unknown, a: Record<string, unknown>) => appendPreferenceSignal(db, a),
  pantryStock,
  reorderPolicies,
}));

const appendLedgerAndReproject = vi.fn<(db: unknown, a: Record<string, unknown>) => Promise<unknown>>(
  async () => ({}),
);
vi.mock("./persist.js", () => ({
  appendLedgerAndReproject: (db: unknown, a: Record<string, unknown>) =>
    appendLedgerAndReproject(db, a),
}));

// Imported AFTER the mocks. signalFromWaste + tuneParForWaste are pure → exercised for real.
const { recordWaste } = await import("./waste-persist.js");

afterEach(() => {
  vi.clearAllMocks();
  ROUTES = {};
  for (const k of Object.keys(updateSet)) delete updateSet[k];
});

describe("recordWaste", () => {
  it("zeroes remaining stock with a spoilage event that preserves the learned rate", async () => {
    ROUTES.pantryStock = [{ onHand: "3", rate: "0.4" }];
    ROUTES.reorderPolicies = []; // no policy → no par tuning
    const db = makeDb();

    const res = await recordWaste(db as never, "user-1", "spinach", "spinach");

    expect(appendLedgerAndReproject).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        userId: "user-1",
        canonicalItemId: "spinach",
        baseQtyDelta: -3, // −onHand
        eventType: "spoilage",
        confidence: 0.9,
        ratePerDay: 0.4, // learned rate carried into the spoilage event, not reset
      }),
    );
    expect(res.wastedBaseQty).toBe(3);
    expect(res.parLowered).toBe(false);
    expect(res.newTargetParQty).toBeNull();
  });

  it("appends a weak NEGATIVE taste signal sourced to waste", async () => {
    ROUTES.pantryStock = [{ onHand: "2", rate: null }];
    ROUTES.reorderPolicies = [];
    const db = makeDb();

    await recordWaste(db as never, "u", "kale-id", "Kale");

    expect(appendPreferenceSignal).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        userId: "u",
        topic: "ingredient:kale", // name lower-cased into the signal key
        polarity: "negative",
        source: "waste",
        confidence: 0.3,
      }),
    );
  });

  it("falls back to the canonical id for the signal key when no name is given", async () => {
    ROUTES.pantryStock = [{ onHand: "1", rate: null }];
    ROUTES.reorderPolicies = [];
    const db = makeDb();

    await recordWaste(db as never, "u", "Canon-ABC");

    expect(appendPreferenceSignal).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ topic: "ingredient:canon-abc" }), // id lower-cased
    );
  });

  it("never emits a positive delta when stock is missing or already zero", async () => {
    ROUTES.pantryStock = []; // no stock row → onHand defaults to 0
    ROUTES.reorderPolicies = [];
    const db = makeDb();

    const res = await recordWaste(db as never, "u", "ghost");

    // The delta must never be POSITIVE (waste only zeroes/decrements). `-0 === 0` in JS, so assert the
    // sign relationally rather than via an objectContaining match that couldn't distinguish them.
    const ledgerArg = (appendLedgerAndReproject.mock.calls[0]![1] as { baseQtyDelta: number; ratePerDay: number | null });
    expect(ledgerArg.baseQtyDelta).toBeLessThanOrEqual(0);
    expect(ledgerArg.ratePerDay).toBeNull();
    expect(res.wastedBaseQty).toBe(0);
  });

  it("lowers the reorder par when a policy exists and the tune reduces it", async () => {
    ROUTES.pantryStock = [{ onHand: "2", rate: "0.3" }];
    ROUTES.reorderPolicies = [{ target: "4", rp: "2" }]; // tune factor 0.75 → 3, a real reduction
    const db = makeDb();

    const res = await recordWaste(db as never, "u", "yogurt", "Yogurt");

    expect(res.parLowered).toBe(true);
    expect(res.newTargetParQty).toBe(3); // 4 × 0.75
    expect(updateSet.reorderPolicies).toHaveBeenCalledWith(
      // both par fields are written: target 4×0.75=3, reorder-point 2×0.75=1.5 (capped ≤ target)
      expect.objectContaining({ targetParQty: "3", reorderPointQty: "1.5" }),
    );
  });

  it("tolerates a policy with null target/reorder-point (no par tune, no throw)", async () => {
    ROUTES.pantryStock = [{ onHand: "2", rate: null }];
    ROUTES.reorderPolicies = [{ target: null, rp: null }]; // null fields → tune sees null target → null
    const db = makeDb();

    const res = await recordWaste(db as never, "u", "flour", "Flour");

    expect(res.parLowered).toBe(false);
    expect(updateSet.reorderPolicies).toBeUndefined();
  });

  it("does NOT lower the par when it is already at the floor (tune returns null)", async () => {
    ROUTES.pantryStock = [{ onHand: "1", rate: null }];
    ROUTES.reorderPolicies = [{ target: "1", rp: "0" }]; // target ≤ minPar(1) → tuneParForWaste returns null
    const db = makeDb();

    const res = await recordWaste(db as never, "u", "salt", "Salt");

    expect(res.parLowered).toBe(false);
    expect(res.newTargetParQty).toBeNull();
    expect(updateSet.reorderPolicies).toBeUndefined(); // no update issued
  });
});
