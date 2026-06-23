import { describe, expect, it } from "vitest";
import {
  reconcileScan,
  type ReconcilePantryItem,
  type ScanDetectionInput,
} from "./reconcile.js";

const item = (
  canonicalItemId: string,
  name: string,
  over: Partial<ReconcilePantryItem> = {},
): ReconcilePantryItem => ({
  canonicalItemId,
  name,
  aliases: [],
  status: "in_stock",
  confidence: 0.7,
  ...over,
});

const det = (rawLabel: string, over: Partial<ScanDetectionInput> = {}): ScanDetectionInput => ({
  rawLabel,
  presenceConfidence: 0.9,
  ...over,
});

describe("reconcileScan", () => {
  it("confirms a detected item that's already in the pantry and raises its confidence", () => {
    const r = reconcileScan([det("milk")], [item("c-milk", "Whole Milk", { confidence: 0.5 })]);
    expect(r.confirmations).toHaveLength(1);
    expect(r.confirmations[0]!.canonicalItemId).toBe("c-milk");
    expect(r.confirmations[0]!.action).toBe("confirm_present");
    expect(r.confirmations[0]!.newConfidence!).toBeGreaterThan(0.5);
    expect(r.newItems).toHaveLength(0);
    expect(r.unconfirmed).toHaveLength(0);
  });

  it("matches via alias and bidirectional token containment", () => {
    const pantry = [item("c-spin", "Spinach", { aliases: ["baby spinach"] })];
    expect(reconcileScan([det("baby spinach")], pantry).confirmations).toHaveLength(1);
    // detector says just "spinach", pantry holds "baby spinach"
    const pantry2 = [item("c-spin", "Baby Spinach")];
    expect(reconcileScan([det("spinach")], pantry2).confirmations[0]!.canonicalItemId).toBe("c-spin");
  });

  it("treats a detected, untracked item as a new-item proposal", () => {
    const r = reconcileScan([det("sriracha")], [item("c-milk", "Milk")]);
    expect(r.confirmations).toHaveLength(0);
    expect(r.newItems).toHaveLength(1);
    expect(r.newItems[0]!.action).toBe("new_item");
    expect(r.newItems[0]!.canonicalItemId).toBeNull();
  });

  it("carries a known catalog id onto a new-item proposal when the detector resolved one", () => {
    const r = reconcileScan([det("ketchup", { canonicalItemId: "c-ketchup" })], [item("c-milk", "Milk")]);
    expect(r.newItems[0]!.canonicalItemId).toBe("c-ketchup");
  });

  it("ABSENCE ≠ DEPLETION: an in-stock item not seen is flagged unconfirmed, never zeroed or marked out", () => {
    const pantry = [
      item("c-milk", "Milk", { confidence: 0.8 }),
      item("c-eggs", "Eggs", { confidence: 0.9 }),
    ];
    const r = reconcileScan([det("milk")], pantry);

    expect(r.confirmations.map((c) => c.canonicalItemId)).toEqual(["c-milk"]);
    expect(r.unconfirmed).toHaveLength(1);
    const eggs = r.unconfirmed[0]!;
    expect(eggs.canonicalItemId).toBe("c-eggs");
    // confidence only mildly lowered, and strictly above zero — the item is still counted.
    expect(eggs.proposedConfidence).toBeLessThan(eggs.prevConfidence);
    expect(eggs.proposedConfidence).toBeGreaterThan(0);
    // nothing in the result implies depletion (no status flip, no quantity field at all).
    expect(Object.keys(eggs)).not.toContain("status");
    expect(Object.keys(eggs)).not.toContain("baseQtyOnHand");
  });

  it("never nags about items already out or expired (only in_stock/low get unconfirmed)", () => {
    const pantry = [
      item("c-out", "Olive Oil", { status: "out" }),
      item("c-exp", "Yogurt", { status: "expired_likely" }),
      item("c-low", "Butter", { status: "low" }),
    ];
    const r = reconcileScan([], pantry);
    expect(r.unconfirmed.map((u) => u.canonicalItemId)).toEqual(["c-low"]);
  });

  it("drops low-confidence detections as noise", () => {
    const r = reconcileScan(
      [det("milk", { presenceConfidence: 0.2 })],
      [item("c-milk", "Milk")],
      { minPresence: 0.4 },
    );
    expect(r.confirmations).toHaveLength(0);
    expect(r.unconfirmed).toHaveLength(1); // milk wasn't confirmed → flagged
  });

  it("de-dupes multiple detections of the same pantry item, keeping the most confident", () => {
    const r = reconcileScan(
      [det("milk", { presenceConfidence: 0.6 }), det("whole milk", { presenceConfidence: 0.95 })],
      [item("c-milk", "Whole Milk")],
    );
    expect(r.confirmations).toHaveLength(1);
    expect(r.confirmations[0]!.presenceConfidence).toBe(0.95);
  });

  it("asks 'same or new?' for a PARTIAL match instead of duplicating or silently merging", () => {
    const r = reconcileScan([det("chicken thighs")], [item("c-chx", "Chicken Breast")]);
    expect(r.confirmations).toHaveLength(0);
    expect(r.newItems).toHaveLength(0);
    expect(r.possibleMatches).toHaveLength(1);
    expect(r.possibleMatches[0]!.candidateId).toBe("c-chx");
    expect(r.possibleMatches[0]!.candidateName).toBe("Chicken Breast");
    expect(r.possibleMatches[0]!.rawLabel).toBe("chicken thighs");
    // It's pending a decision — so it must NOT also be nagged as "didn't see it".
    expect(r.unconfirmed).toHaveLength(0);
  });

  it("a containment match still confirms outright (no needless 'same or new?' prompt)", () => {
    const r = reconcileScan([det("milk")], [item("c-milk", "Whole Milk")]);
    expect(r.confirmations).toHaveLength(1);
    expect(r.possibleMatches).toHaveLength(0);
  });

  it("drops a possible match when another detection confirms that same pantry item", () => {
    const r = reconcileScan(
      [det("chicken breast"), det("chicken thighs")],
      [item("c-chx", "Chicken Breast")],
    );
    expect(r.confirmations.map((c) => c.canonicalItemId)).toEqual(["c-chx"]);
    expect(r.possibleMatches).toHaveLength(0);
    expect(r.newItems).toHaveLength(0);
  });

  it("an unrelated detection is a clean new item, not a possible match", () => {
    const r = reconcileScan([det("sriracha")], [item("c-milk", "Milk")]);
    expect(r.possibleMatches).toHaveLength(0);
    expect(r.newItems).toHaveLength(1);
  });

  it("a semantic candidate (softMatchId) is asked about, not auto-confirmed — 'pop' → 'soda'", () => {
    const r = reconcileScan([det("pop", { softMatchId: "c-soda" })], [item("c-soda", "Soda")]);
    expect(r.confirmations).toHaveLength(0);
    expect(r.newItems).toHaveLength(0);
    expect(r.possibleMatches).toHaveLength(1);
    expect(r.possibleMatches[0]!.candidateId).toBe("c-soda");
    expect(r.possibleMatches[0]!.candidateName).toBe("Soda");
    // pending a decision → not also flagged "didn't see it"
    expect(r.unconfirmed).toHaveLength(0);
  });

  it("an explicit in-pantry canonicalItemId still auto-confirms (deterministic match)", () => {
    const r = reconcileScan([det("fizzy drink", { canonicalItemId: "c-soda" })], [item("c-soda", "Soda")]);
    expect(r.confirmations).toHaveLength(1);
    expect(r.possibleMatches).toHaveLength(0);
  });

  it("a softMatchId that isn't in the pantry doesn't invent a possible match", () => {
    const r = reconcileScan([det("pop", { softMatchId: "c-ghost" })], [item("c-milk", "Milk")]);
    expect(r.possibleMatches).toHaveLength(0);
    expect(r.newItems).toHaveLength(1);
  });

  it("respects the unseen floor so confidence can't collapse", () => {
    const r = reconcileScan([], [item("c-x", "X", { confidence: 0.31 })], {
      unseenDecay: 0.85,
      unseenFloor: 0.3,
    });
    expect(r.unconfirmed[0]!.proposedConfidence).toBe(0.3); // 0.31*0.85≈0.26 → floored to 0.3
  });
});
